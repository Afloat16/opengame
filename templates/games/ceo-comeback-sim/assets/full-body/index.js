System.register("chunks:///_virtual/full-body",["./full-body.ts"],(function(){return{setters:[null],execute:function(){}}}));

System.register("chunks:///_virtual/full-body.ts",["./rollupPluginModLoBabelHelpers.js","cc","./UI.ts","./dict.ts","./vo.ts","./Popup.ts","./Enum.ts","./Event.ts","./Cocos.ts","./formula.ts"],(function(t){var s,n,e,i,o,a,r,u,l,d,c,p,f,y,h,v,N,m;return{setters:[function(t){s=t.applyDecoratedDescriptor,n=t.inheritsLoose,e=t.initializerDefineProperty,i=t.assertThisInitialized},function(t){o=t.cclegacy,a=t._decorator,r=t.Node,u=t.Sprite},function(t){l=t.BaseUIComponent},function(t){d=t.GameAssistantList},function(t){c=t.runtimeVo},function(t){p=t.PopupManager},function(t){f=t.UIDef},function(t){y=t.GDispatcher,h=t.GEvent},function(t){v=t.setSpriteImage,N=t.runtimeBundles},function(t){m=t.getUserBodyUrl}],execute:function(){var b,A,B,E,g,P,T;o._RF.push({},"d7de1bw8/xP1oTMqqfhQk0q","full-body",void 0);var S=a.ccclass,_=a.property;t("GameFullBodyPrefabScript",(b=S("GameFullBodyPrefabScript"),A=_(r),B=_(r),b((P=s((g=function(t){function s(){for(var s,n=arguments.length,o=new Array(n),a=0;a<n;a++)o[a]=arguments[a];return s=t.call.apply(t,[this].concat(o))||this,e(s,"assistantContainer",P,i(s)),e(s,"myBody",T,i(s)),s.assistantNodes=void 0,s}n(s,t);var o=s.prototype;return o.onLoad=function(){var s=this;t.prototype.onLoad.call(this),this.readAssistantNodes(),y.on(h.EVENT_UPDATE_ASSISTANT,(function(t){s.updateAssistants(t)})),y.on(h.EVENT_UPDATE_LEVEL,(function(){s.updateBody()})),this.updateBody()},o.updateBody=function(){v(N.fullBody,this.myBody.getComponent(u),m(c.user.level))},o.readAssistantNodes=function(){var t=this;this.assistantNodes=new Map,d.forEach((function(s){var n=t.assistantContainer.getChildByName("assistant-"+s.id);t.assistantNodes.set(s.id,n),t.enableAssistantNode(s.id,n)}))},o.enableAssistantNode=function(t,s){c.user.assistants.has(t)&&(s.active||(s.active=!0,s.on(r.EventType.TOUCH_END,(function(){p.open(f.POPUP_ASSISTANT,{id:t})}),this)))},o.updateAssistants=function(t){if(null!=t&&null!=t.id&&""!=t.id&&null!=this.assistantNodes&&this.assistantNodes.has(t.id)){var s=this.assistantNodes.get(t.id);null!=s&&this.enableAssistantNode(t.id,s)}},s}(l)).prototype,"assistantContainer",[A],{configurable:!0,enumerable:!0,writable:!0,initializer:null}),T=s(g.prototype,"myBody",[B],{configurable:!0,enumerable:!0,writable:!0,initializer:null}),E=g))||E));o._RF.pop()}}}));

(function(r) {
  r('virtual:///prerequisite-imports/full-body', 'chunks:///_virtual/full-body'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});