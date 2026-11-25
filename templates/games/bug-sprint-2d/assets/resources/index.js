System.register("chunks:///_virtual/en.ts",["cc"],(function(e){var t;return{setters:[function(e){t=e.cclegacy}],execute:function(){t._RF.push({},"0eed7sGB5VKPq8aqRJYmWA3","en",void 0);var n=window,s=e("languages",{buff:{freeze:"freeze"},fightUI:{txt:"Press and hold the screen to speed up"},relive:{txt:"s post automatic exit",btnLb:"Direct reactivation"},setting:{btnLabel:"whosyourdaddy","level id":"Enter level id"},home:{height:"Best in history:"},settlement:{height:"All-time high score:"}});n.languages||(n.languages={}),n.languages.en=s,t._RF.pop()}}}));

System.register("chunks:///_virtual/resources",["./en.ts","./zh.ts"],(function(){return{setters:[null,null],execute:function(){}}}));

System.register("chunks:///_virtual/zh.ts",["cc"],(function(e){var t;return{setters:[function(e){t=e.cclegacy}],execute:function(){t._RF.push({},"45b76p0KrFDf5kR4AmZWDHr","zh",void 0);var n=window,g=e("languages",{buff:{freeze:"冻结"},fightUI:{txt:"按住屏幕加速快跑"},relive:{txt:"秒后自动退出",btnLb:"直接复活"},setting:{btnLabel:"无敌模式",chooseLevel:"输入关卡id"},home:{height:"历史最佳:"},settlement:{height:"历史最高分："}});n.languages||(n.languages={}),n.languages.zh=g,t._RF.pop()}}}));

(function(r) {
  r('virtual:///prerequisite-imports/resources', 'chunks:///_virtual/resources'); 
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