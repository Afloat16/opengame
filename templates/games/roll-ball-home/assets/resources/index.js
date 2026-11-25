System.register("chunks:///_virtual/AirHint.ts",["./rollupPluginModLoBabelHelpers.js","cc"],(function(t){var e,n,i,o,r,a,c,s,p,l,u,d,h,y,f,g;return{setters:[function(t){e=t.applyDecoratedDescriptor,n=t.inheritsLoose,i=t.createClass},function(t){o=t.cclegacy,r=t._decorator,a=t.CCString,c=t.Label,s=t.UIOpacity,p=t.tween,l=t.resources,u=t.Prefab,d=t.view,h=t.instantiate,y=t.v3,f=t.director,g=t.Component}],execute:function(){var x,v,b,_;o._RF.push({},"5c676IeAddBR5GmTa1mnqba","AirHint",void 0);var C=r.ccclass,m=r.property,L=r.executeInEditMode;t("default",(x=C("AirHint"),v=m(a),x(b=L((e((_=function(t){function e(){for(var e,n=arguments.length,i=new Array(n),o=0;o<n;o++)i[o]=arguments[o];return(e=t.call.apply(t,[this].concat(i))||this)._text="",e._textLabel=void 0,e}return n(e,t),e.prototype.onLoad=function(){var t=this;this._textLabel=this.node.getChildByName("text").getComponent(c);var e=this.node.getComponent(s);p(e).set({opacity:55}).by(1,{opacity:200}).delay(1).call((function(){t.node.destroy()})).start()},e.create=function(t){l.load("prefabs/AirHint",u,(function(n,i){var o=d.getVisibleSize(),r=h(i);r.position=y(o.width/2,o.height/2),f.getScene().addChild(r);var a=r.getComponent(e);a&&(a.text=t)}))},i(e,[{key:"text",get:function(){return this._text},set:function(t){this._text=t,this._textLabel&&(this._textLabel.string=this._text)}}]),e}(g)).prototype,"text",[v],Object.getOwnPropertyDescriptor(_.prototype,"text"),_.prototype),b=_))||b)||b));o._RF.pop()}}}));

System.register("chunks:///_virtual/resources",["./AirHint.ts"],(function(){return{setters:[null],execute:function(){}}}));

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