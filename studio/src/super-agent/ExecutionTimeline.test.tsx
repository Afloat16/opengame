// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SuperAgentActionCard, SuperAgentChat } from '../../../shared/super-agent';
import { I18nProvider } from '../i18n/I18n';
import { gatewayRequest } from '../motion/gatewayClient';
import { workspacePageHref } from '../motion/workspacePageRouting';
import { ExecutionTimeline } from './ExecutionTimeline';

vi.mock('../motion/gatewayClient', () => ({ gatewayRequest: vi.fn(async () => ({ state: 'signed-out', consoleUrl: '' })) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
});

function chatWithCards(cards: SuperAgentActionCard[]): SuperAgentChat {
  const now = Date.now();
  return {
    id: 'chat-action-cards',
    title: 'Game with art',
    engine: 'codex',
    model: 'default',
    reasoning: 'default',
    permissionMode: 'on-request',
    state: 'idle',
    createdAt: now,
    updatedAt: now,
    messages: [
      { id: 'u1', role: 'user', text: 'Make an anime RPG', createdAt: now },
      ...cards.map((card, idx) => ({
        id: `tool:call-${idx}`,
        role: 'tool' as const,
        text: 'openmotion_open_preview',
        createdAt: now + idx + 1,
        toolEvent: {
          callId: `call-${idx}`,
          tool: 'openmotion_open_preview',
          label: 'Open settings',
          status: 'completed' as const,
          actionCard: card,
          startedAt: now + idx + 1,
          finishedAt: now + idx + 2,
        },
      })),
      { id: 'a1', role: 'assistant', text: 'Please sign in or upgrade to continue.', createdAt: now + 10 },
    ],
    artifacts: [],
    approvals: [],
  };
}

describe('ExecutionTimeline inline action cards', () => {
  it('renders deduplicated onboarding/top-up action cards and fires callback on click', async () => {
    const onTriggerActionCard = vi.fn();
    const cards: SuperAgentActionCard[] = [
      { id: 'c1', kind: 'sign_in', entry: 'agent_media_signed_out', provider: 'account' },
      { id: 'c1-dup', kind: 'sign_in', entry: 'agent_media_signed_out', provider: 'account' },
      { id: 'c2', kind: 'upgrade_go', entry: 'agent_media_upgrade_go', provider: 'account' },
      { id: 'c3', kind: 'top_up', entry: 'agent_media_balance_low', provider: 'account' },
    ];

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={chatWithCards(cards)}
            busy={false}
            sending={false}
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
            onTriggerActionCard={onTriggerActionCard}
          />
        </I18nProvider>,
      );
    });

    const renderedCards = container.querySelectorAll('.om-sa-action-card');
    expect(renderedCards).toHaveLength(3);
    expect(container.textContent).toContain('Sign in with OpenDesign');
    expect(container.textContent).toContain('Upgrade to OpenDesign Plus');
    expect(container.textContent).toContain('Top up OpenDesign balance');

    const signInBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Sign in & continue');
    expect(signInBtn).toBeTruthy();
    expect(signInBtn?.getAttribute('aria-describedby')).toBeTruthy();
    await act(async () => {
      signInBtn!.click();
    });
    expect(gatewayRequest).toHaveBeenCalledWith('settings/account/login', 'POST', { hookId: 'studio_generate', entryId: expect.any(String) });
    // Account cards are handled in the card itself; top-up keeps the #24 balance gate (not the trigger callback).
    expect(onTriggerActionCard).not.toHaveBeenCalled();
  });

  it('suppresses redundant generic sign_in cards when web_publish_sign_in is present in the same turn', async () => {
    const onTriggerActionCard = vi.fn();
    const cards: SuperAgentActionCard[] = [
      { id: 'pub-1', kind: 'web_publish_sign_in', entry: 'agent_media_signed_out', provider: 'account', targetKind: 'game', targetId: 'g-1' },
      { id: 'gen-1', kind: 'sign_in', entry: 'agent_media_signed_out', provider: 'account' },
    ];

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={chatWithCards(cards)}
            busy={false}
            sending={false}
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
            onTriggerActionCard={onTriggerActionCard}
          />
        </I18nProvider>,
      );
    });

    const renderedCards = container.querySelectorAll('.om-sa-action-card');
    expect(renderedCards).toHaveLength(1);
    expect(renderedCards[0]?.getAttribute('data-kind')).toBe('web_publish_sign_in');
    expect(container.textContent).toContain('Sign in to publish online');

    const publishBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.trim() === 'Sign in & publish');
    expect(publishBtn).toBeTruthy();
    await act(async () => {
      publishBtn!.click();
    });
    // Signs in inside the card with the game publish hook instead of jumping to settings.
    expect(gatewayRequest).toHaveBeenCalledWith('settings/account/login', 'POST', { hookId: 'game_publish_signin', entryId: expect.any(String) });
    expect(onTriggerActionCard).not.toHaveBeenCalled();
  });

  it('suppresses stale action cards on older turns once a newer turn exists', async () => {
    const now = Date.now();
    const multiTurnChat: SuperAgentChat = {
      id: 'chat-multi-turn',
      title: 'Game follow-up',
      engine: 'codex',
      model: 'default',
      reasoning: 'default',
      permissionMode: 'on-request',
      state: 'idle',
      createdAt: now,
      updatedAt: now + 50,
      messages: [
        { id: 'u1', role: 'user', text: 'Make a character RPG', createdAt: now },
        {
          id: 'tool:c1',
          role: 'tool',
          text: 'openmotion_open_preview',
          createdAt: now + 1,
          toolEvent: {
            callId: 'c1',
            tool: 'openmotion_open_preview',
            label: 'Open settings',
            status: 'completed',
            actionCard: { id: 'old-sign-in', kind: 'sign_in', entry: 'agent_media_signed_out', provider: 'account' },
            startedAt: now + 1,
            finishedAt: now + 2,
          },
        },
        { id: 'a1', role: 'assistant', text: 'Sign in first.', createdAt: now + 5 },
        { id: 'u2', role: 'user', text: 'Done, continue!', createdAt: now + 10 },
        { id: 'a2', role: 'assistant', text: 'Generating art now.', createdAt: now + 15 },
      ],
      artifacts: [],
      approvals: [],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={multiTurnChat}
            busy={false}
            sending={false}
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
            onTriggerActionCard={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    expect(container.querySelectorAll('.om-sa-action-card')).toHaveLength(0);
  });

  it('sets entry_from when routing to provider settings from an action card', () => {
    const href = workspacePageHref('http://localhost/studios/game', {
      settings: 'providers',
      provider: 'account',
      entryFrom: 'agent_media_upgrade_free',
    });
    expect(href).toBe('/settings/providers?entry_from=agent_media_upgrade_free&provider=account');
  });
});

describe('ExecutionTimeline creator-first progressive disclosure', () => {
  it('collapses noisy startup prep traces into a calm L1 digest while running and groups/sanitizes them on expand', async () => {
    const now = Date.now();
    const guideSections = ['start', 'craft', 'controls', 'lookup', 'flow', 'playable', 'gates', 'genres', 'brief', 'audio', 'style', 'review'];
    const chat: SuperAgentChat = {
      id: 'chat-game-running',
      title: '做一个类似羊了个羊的小游戏',
      intent: 'game',
      engine: 'codex',
      model: 'default',
      permissionMode: 'auto',
      state: 'running',
      createdAt: now - 28_000,
      updatedAt: now,
      turnActivity: {
        phase: 'thinking',
        startedAt: now - 28_000,
        updatedAt: now,
      },
      artifacts: [],
      approvals: [],
      messages: [
        { id: 'u1', role: 'user', text: '我想做一个类似羊了个羊的小游戏', createdAt: now - 28_000 },
        {
          id: 'a-note',
          role: 'assistant',
          text: '我会用 OpenMotion 游戏工作流做一款原创竖屏叠牌消除游戏，保留「点牌入槽、三张消除」的玩法。',
          createdAt: now - 27_000,
          status: 'completed',
        },
        {
          id: 't-inspect-1',
          role: 'tool',
          text: 'openmotion_media_use',
          createdAt: now - 26_500,
          toolEvent: {
            callId: 'c-inspect-1',
            tool: 'openmotion_media_use',
            label: 'Checked media providers',
            status: 'completed',
            category: 'mcp',
            summary: 'inspect',
            inputPreview: JSON.stringify({ action: 'inspect', modality: 'image' }),
            durationMs: 934,
            startedAt: now - 26_500,
            finishedAt: now - 25_566,
          },
        },
        {
          id: 't-game-get',
          role: 'tool',
          text: 'openmotion_game_get',
          createdAt: now - 26_400,
          toolEvent: {
            callId: 'c-game-get',
            tool: 'openmotion_game_get',
            label: 'Inspected game files & state',
            status: 'completed',
            category: 'mcp',
            durationMs: 937,
            startedAt: now - 26_400,
            finishedAt: now - 25_463,
          },
        },
        {
          id: 't-mem-probe',
          role: 'tool',
          text: 'commandExecution',
          createdAt: now - 25_000,
          toolEvent: {
            callId: 'c-mem-probe',
            tool: 'commandExecution',
            label: 'Executed command',
            status: 'completed',
            category: 'command',
            command: `/bin/zsh -lc "rg -n '试玩广告|playable ad|Game Studio|游戏交付' ~/.codex/memories/MEMORY.md"`,
            summary: `/bin/zsh -lc "rg -n '试玩广告|playable ad|Game Studio|游戏交付' ~/.codex/memories/MEMORY.md"`,
            exitCode: 0,
            durationMs: 1,
            startedAt: now - 25_000,
            finishedAt: now - 24_999,
          },
        },
        ...guideSections.map((section, idx) => ({
          id: `t-guide-${section}`,
          role: 'tool' as const,
          text: 'openmotion_read_workflow',
          createdAt: now - 24_000 + idx * 10,
          toolEvent: {
            callId: `c-guide-${section}`,
            tool: 'openmotion_read_workflow',
            label: 'Read workflow guidance',
            status: 'completed' as const,
            category: 'mcp' as const,
            inputPreview: JSON.stringify({ workflow: 'game', section }),
            durationMs: 12,
            startedAt: now - 24_000 + idx * 10,
            finishedAt: now - 23_988 + idx * 10,
          },
        })),
        ...[0, 1, 2, 3].map(idx => ({
          id: `t-read-err-${idx}`,
          role: 'tool' as const,
          text: 'openmotion_game_read_file',
          createdAt: now - 20_000 + idx * 25,
          toolEvent: {
            callId: `c-read-err-${idx}`,
            tool: 'openmotion_game_read_file',
            label: 'Read game source file',
            status: 'failed' as const,
            category: 'file_read' as const,
            summary: 'INVALID_ARGUMENT: arguments.id is required',
            outputPreview: '{"error":"INVALID_ARGUMENT: arguments.id is required"}',
            durationMs: 19,
            startedAt: now - 20_000 + idx * 25,
            finishedAt: now - 19_981 + idx * 25,
          },
        })),
        {
          id: 't-ref',
          role: 'tool',
          text: 'openmotion_media_use',
          createdAt: now - 19_000,
          toolEvent: {
            callId: 'c-ref',
            tool: 'openmotion_media_use',
            label: 'Checked media gateway',
            status: 'completed',
            category: 'mcp',
            summary: 'reference',
            inputPreview: JSON.stringify({ action: 'reference' }),
            durationMs: 11,
            startedAt: now - 19_000,
            finishedAt: now - 18_989,
          },
        },
        {
          id: 't-cap',
          role: 'tool',
          text: 'openmotion_capability_discover',
          createdAt: now - 18_000,
          toolEvent: {
            callId: 'c-cap',
            tool: 'openmotion_capability_discover',
            label: 'Browsed capability catalog',
            status: 'completed',
            category: 'mcp',
            summary: '14 capability(s)',
            inputPreview: JSON.stringify({ action: 'list' }),
            durationMs: 15,
            startedAt: now - 18_000,
            finishedAt: now - 17_985,
          },
        },
      ],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="zh-CN">
          <ExecutionTimeline
            chat={chat}
            busy
            sending={false}
            engineLabel="Codex"
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    // L1 default: collapsed raw trace, calm digest, zero fake step fraction or red alarm
    expect(container.querySelector('.om-sa-work-items')).toBeNull();
    expect(container.querySelector('.om-sa-work-summary-meta')).toBeNull();
    expect(container.querySelector('.om-sa-work-pill')).toBeNull();

    const digest = container.querySelector('.om-sa-live-digest')!;
    expect(digest).toBeTruthy();
    expect(digest.textContent).toContain('我会用游戏创作流程做一款原创竖屏叠牌消除游戏');
    expect(digest.textContent).not.toContain('OpenMotion 游戏工作流');
    expect(digest.textContent).not.toContain('用 游戏创作流程');
    expect(digest.textContent).toContain('已查阅创作规范与项目上下文');
    expect(digest.textContent).toContain('正在思考…');
    expect(container.textContent).not.toContain('INVALID_ARGUMENT');
    expect(container.textContent).not.toContain('MEMORY.md');
    expect(container.textContent).not.toContain('capability(s)');

    // Expand L2: L1 digest unmounts (no duplicated note), all 21 consecutive prep steps fold into 1 group
    const summaryBtn = container.querySelector<HTMLButtonElement>('.om-sa-work-summary-btn')!;
    await act(async () => summaryBtn.click());
    expect(container.querySelector('.om-sa-live-digest')).toBeNull();
    expect(container.querySelectorAll('.om-sa-progress-note-row')).toHaveLength(1);
    const prepGroups = container.querySelectorAll('.om-sa-prep-group');
    expect(prepGroups).toHaveLength(1);
    expect(prepGroups[0].textContent).toContain('21 项检查');

    // Expand prep group: retried arg errors are quiet (never red), memory probe sanitized, counts localized
    const prepTrigger = prepGroups[0].querySelector<HTMLButtonElement>('.om-sa-prep-group-trigger')!;
    await act(async () => prepTrigger.click());
    expect(container.querySelectorAll('.om-sa-tool-status[data-status="failed"]')).toHaveLength(0);
    expect(container.querySelectorAll('.om-sa-tool-row[data-retried="true"]')).toHaveLength(4);
    expect(container.textContent).toContain('已自动调整参数重试');
    expect(container.textContent).toContain('已检索本地上下文记忆');
    expect(container.textContent).toContain('14 项能力');
    expect(container.textContent).not.toContain('14 capability(s)');
    expect(container.textContent).not.toContain('exit 0');
    expect(container.textContent).not.toContain('19ms');
    const summaryValues = [...container.querySelectorAll('.om-sa-tool-summary')].map(el => el.textContent?.trim());
    expect(summaryValues).not.toContain('inspect');
    expect(summaryValues).not.toContain('reference');
  });

  it('keeps media-generation status polling out of prep noise and surfaces completed asset milestones in L1', async () => {
    const now = Date.now();
    const onOpenArtifactId = vi.fn();
    const chat: SuperAgentChat = {
      id: 'chat-media-milestones',
      title: '像素风解谜游戏',
      intent: 'game',
      engine: 'codex',
      permissionMode: 'auto',
      state: 'running',
      createdAt: now - 45_000,
      updatedAt: now,
      turnActivity: {
        phase: 'tool',
        label: 'Checked media generation job',
        activeToolName: 'openmotion_assets_use',
        startedAt: now - 45_000,
        updatedAt: now,
      },
      artifacts: [],
      approvals: [],
      messages: [
        { id: 'u1', role: 'user', text: '做一款像素风解谜游戏', createdAt: now - 45_000 },
        {
          id: 't-create',
          role: 'tool',
          text: 'openmotion_game_create',
          createdAt: now - 40_000,
          toolEvent: {
            callId: 'c-create',
            tool: 'openmotion_game_create',
            label: 'Created interactive game project',
            status: 'completed',
            category: 'mcp',
            startedAt: now - 40_000,
            finishedAt: now - 39_500,
          },
        },
        {
          id: 't-bgm-done',
          role: 'tool',
          text: 'openmotion_assets_use',
          createdAt: now - 30_000,
          toolEvent: {
            callId: 'c-bgm-done',
            tool: 'openmotion_assets_use',
            label: 'Checked media generation job',
            status: 'completed',
            category: 'mcp',
            inputPreview: JSON.stringify({ action: 'status', jobId: 'job-bgm' }),
            artifactId: 'asset:bgm-1',
            startedAt: now - 30_000,
            finishedAt: now - 20_000,
          },
        },
        {
          id: 't-art-wait',
          role: 'tool',
          text: 'openmotion_assets_use',
          createdAt: now - 10_000,
          toolEvent: {
            callId: 'c-art-wait',
            tool: 'openmotion_assets_use',
            label: 'Checked media generation job',
            status: 'running',
            category: 'mcp',
            inputPreview: JSON.stringify({ action: 'status', jobId: 'job-art' }),
            startedAt: now - 10_000,
          },
        },
      ],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={chat}
            busy
            sending={false}
            engineLabel="Codex"
            onOpenArtifactId={onOpenArtifactId}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    const digest = container.querySelector('.om-sa-live-digest')!;
    expect(digest).toBeTruthy();
    expect(digest.textContent).toContain('Waiting for media generation…');
    expect(digest.textContent).not.toContain('Preparing workflow guides');
    const milestones = [...digest.querySelectorAll('.om-sa-live-milestone-row')];
    expect(milestones).toHaveLength(2);
    expect(milestones[0].textContent).toContain('Created interactive game project');
    expect(milestones[1].textContent).toContain('Checked media generation job');

    const viewBtn = milestones[1].querySelector<HTMLButtonElement>('.om-sa-tool-view-btn')!;
    expect(viewBtn).toBeTruthy();
    await act(async () => viewBtn.click());
    expect(onOpenArtifactId).toHaveBeenCalledWith('asset:bgm-1');
  });

  it('auto-expands stopped creative turns on terminal write failures and never disguises mutating memory commands', async () => {
    const now = Date.now();
    const stoppedChat: SuperAgentChat = {
      id: 'chat-stopped-failure',
      title: 'Broken write',
      intent: 'game',
      engine: 'codex',
      permissionMode: 'auto',
      state: 'idle',
      createdAt: now - 10_000,
      updatedAt: now,
      artifacts: [],
      approvals: [],
      messages: [
        { id: 'u1', role: 'user', text: 'Build a game', createdAt: now - 10_000 },
        {
          id: 't-mutating-mem',
          role: 'tool',
          text: 'commandExecution',
          createdAt: now - 8_000,
          toolEvent: {
            callId: 'c-mutating-mem',
            tool: 'commandExecution',
            label: 'Executed command',
            status: 'completed',
            category: 'command',
            command: `/bin/zsh -lc "rg foo ~/.codex/memories/MEMORY.md && echo bad >> ~/.codex/memories/MEMORY.md"`,
            summary: `/bin/zsh -lc "rg foo ~/.codex/memories/MEMORY.md && echo bad >> ~/.codex/memories/MEMORY.md"`,
            exitCode: 0,
            durationMs: 12,
            startedAt: now - 8_000,
            finishedAt: now - 7_988,
          },
        },
        {
          id: 't-write-err',
          role: 'tool',
          text: 'openmotion_game_write_files',
          createdAt: now - 5_000,
          toolEvent: {
            callId: 'c-write-err',
            tool: 'openmotion_game_write_files',
            label: 'Updated game source files',
            status: 'failed',
            category: 'file_edit',
            summary: 'INVALID_ARGUMENT: arguments.files is required',
            startedAt: now - 5_000,
            finishedAt: now - 4_950,
          },
        },
      ],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={stoppedChat}
            busy={false}
            sending={false}
            engineLabel="Codex"
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    // Stopped creative turn auto-expands, keeps Needs attention for terminal write error, and exposes mutating shell command
    expect(container.querySelector('.om-sa-work-items')).toBeTruthy();
    expect(container.querySelector('.om-sa-work-pill[data-tone="danger"]')?.textContent).toBe('Needs attention');
    expect(container.textContent).not.toContain('Checked workspace memory');
    expect(container.textContent).toContain('echo bad >> ~/.codex/memories/MEMORY.md');
  });

  it('omits raw step counts on completed creative turns while keeping them on coding turns', async () => {
    const now = Date.now();
    const baseMessages: SuperAgentChat['messages'] = [
      { id: 'u1', role: 'user', text: 'Build UI', createdAt: now - 5_000 },
      {
        id: 't1',
        role: 'tool',
        text: 'openmotion_game_write_files',
        createdAt: now - 4_000,
        toolEvent: {
          callId: 'c1',
          tool: 'openmotion_game_write_files',
          label: 'Updated game source files',
          status: 'completed',
          category: 'file_edit',
          startedAt: now - 4_000,
          finishedAt: now - 3_000,
        },
      },
      { id: 'a1', role: 'assistant', text: 'All set!', createdAt: now - 1_000, status: 'completed' },
    ];

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={{
              id: 'chat-creative-done',
              title: 'Game done',
              intent: 'game',
              engine: 'codex',
              permissionMode: 'auto',
              state: 'idle',
              createdAt: now - 5_000,
              updatedAt: now,
              lastTurnDurationMs: 4_000,
              messages: baseMessages,
              artifacts: [],
              approvals: [],
            }}
            busy={false}
            sending={false}
            engineLabel="Codex"
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    expect(container.querySelector('.om-sa-work-summary-label')?.textContent).toBe('Worked for 4.0s');
    expect(container.querySelector('.om-sa-turn-meta')?.textContent).toBe('Codex · 4.0s');

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="en">
          <ExecutionTimeline
            chat={{
              id: 'chat-coding-running',
              title: 'Code task',
              intent: 'coding',
              engine: 'codex',
              permissionMode: 'auto',
              state: 'running',
              createdAt: now - 5_000,
              updatedAt: now,
              messages: baseMessages.slice(0, 2),
              artifacts: [],
              approvals: [],
            }}
            busy
            sending={false}
            engineLabel="Codex"
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    // Coding turn stays auto-expanded while running without a fake 1/1 steps counter
    expect(container.querySelector('.om-sa-work-items')).toBeTruthy();
    expect(container.querySelector('.om-sa-work-summary-meta')).toBeNull();
  });

  it('promotes the primary game deliverable as a Hero card above supporting media assets and demotes changed files on creative turns', async () => {
    const now = Date.now();
    const chat: SuperAgentChat = {
      id: 'chat-fruit-done',
      title: '叠叠果摊',
      intent: 'game',
      engine: 'codex',
      permissionMode: 'auto',
      state: 'idle',
      createdAt: now - 60_000,
      updatedAt: now,
      lastTurnDurationMs: 60_000,
      approvals: [],
      turnChangedFiles: {
        u1: [{ action: 'create', path: 'index.html', addedLines: 200 }],
      },
      artifacts: [
        {
          id: 'asset:bg-1',
          kind: 'asset-image',
          title: '果摊晨市背景',
          subtitle: 'account:gpt-image-2',
          assetId: 'bg-1',
          versionId: 'v-1',
          url: '/motion-api/assets/bg-1/versions/v-1/media',
          createdAt: now - 50_000,
          updatedAt: now - 50_000,
        },
        {
          id: 'asset:bgm-1',
          kind: 'asset-audio',
          title: '果摊晨曲',
          subtitle: 'account:elevenlabs-music-v2',
          assetId: 'bgm-1',
          versionId: 'v-1',
          url: '/motion-api/assets/bgm-1/versions/v-1/media',
          createdAt: now - 40_000,
          updatedAt: now - 40_000,
        },
        {
          id: 'game:fruit-stack',
          kind: 'game-project',
          title: '叠叠果摊',
          subtitle: 'casual · Playable ad',
          playableAd: true,
          scenario: 'portrait',
          projectId: 'fruit-stack',
          url: '/motion-api/games/fruit-stack/play/index.html',
          createdAt: now - 20_000,
          updatedAt: now - 10_000,
        },
      ],
      messages: [
        { id: 'u1', role: 'user', text: '我想做一个类似羊了个羊的小游戏', createdAt: now - 60_000 },
        { id: 'a1', role: 'assistant', text: '《叠叠果摊》做好了，点下方即可试玩。', createdAt: now - 5_000, status: 'completed' },
      ],
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <I18nProvider initialLocale="zh-CN">
          <ExecutionTimeline
            chat={chat}
            busy={false}
            sending={false}
            engineLabel="Codex"
            activeViewerArtifactId="game:fruit-stack"
            onOpenArtifactId={vi.fn()}
            onPreviewAttachment={vi.fn()}
            onCopyText={vi.fn()}
            onApprove={vi.fn()}
            onOpenInAssets={vi.fn()}
          />
        </I18nProvider>,
      );
    });

    // Only 1 Hero primary deliverable card, with active Viewer feedback and portrait cover
    const heroCards = container.querySelectorAll('.om-sa-deliverable-card[data-layout="hero"]');
    expect(heroCards).toHaveLength(1);
    expect(heroCards[0].textContent).toContain('叠叠果摊');
    expect(heroCards[0].textContent).toContain('右侧试玩中');
    expect(heroCards[0].getAttribute('data-portrait-cover')).toBe('true');

    // Supporting media assets live in the quiet secondary strip below Hero (with cleaned model names)
    const supportingRows = container.querySelectorAll('.om-sa-supporting-row');
    expect(supportingRows).toHaveLength(2);
    expect(container.querySelector('.om-sa-supporting-assets')?.textContent).toContain('配套素材（2）');
    expect(container.querySelector('.om-sa-supporting-assets')?.textContent).toContain('GPT Image 2');
    expect(container.querySelector('.om-sa-supporting-assets')?.textContent).toContain('Eleven Music v2');
    expect(container.textContent).not.toContain('account:');

    // Deliverables come BEFORE subtle FilesChangedCard on creative turns
    const deliverablesEl = container.querySelector('.om-sa-deliverables-group')!;
    const filesEl = container.querySelector('.om-sa-files-changed')!;
    expect(deliverablesEl.compareDocumentPosition(filesEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filesEl.getAttribute('data-subtle')).toBe('true');
  });
});
