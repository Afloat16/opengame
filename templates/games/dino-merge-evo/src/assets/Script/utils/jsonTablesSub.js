(function(root){var exports=undefined,module=undefined,require=undefined;var define=undefined;var self=root,window=root,global=root,globalThis=root;(function(){//此文件为工具生成，不允许修改
window.jsonTables=window.jsonTables||{};window.tb=window.tb||{};//枚举
//表格名常量
jsonTables.TABLE={BATTLE:"battle",// [BATTLE] 
ITEM:"item",// [ITEM] 
CFG:"cfg",// [CFG] 
DINO:"dino",// [DINO] 
HUMANTYPE:"humanType",// [HUMANTYPE] 
DINOTYPE:"dinoType",// [DINOTYPE] 
HUMAN:"human"// [HUMAN] 
};//表格字段常量
//[battle]
jsonTables.CONFIG_BATTLE={Tid:"Tid",//战役 
Human:"Human",//猎人配置 
PosHuman:"posHuman",//猎人站位 
Dino:"Dino",//恐龙配置 
PosDino:"posDino"//恐龙站位 
};//[item]
jsonTables.CONFIG_ITEM={Tid:"Tid",//道具 
Name:"name",//名字 
Price:"price",//购买价格 
PicPackage:"picPackage",//图片所属分包 
PicPath:"picPath"//图片路径 
};//[cfg]
jsonTables.CONFIG_CFG={Tid:"Tid",//配置 
Shop1RefreshCost:"shop1RefreshCost",//随机商店刷新初始价格 
Shop1RefreshAdd:"shop1RefreshAdd"//随机商店刷新递增价格 
};//[dino]
jsonTables.CONFIG_DINO={Tid:"Tid",//兵种编号 
Name:"name",//名字 
ArmType:"armType",//类型（1猎人，2恐龙） 
Type:"type",//类型 
Quality:"quality",//品质(1普通，2变异) 
Exp:"exp",//掉落金币 
Attack:"attack",//攻击力 
Hp:"hp",//生命值 
EggRate:"eggRate",//龙蛋掉落概率(1/10000) 
EggTime:"eggTime"//孵化时间 
};//[humanType]
jsonTables.CONFIG_HUMANTYPE={Tid:"Tid",//兵种 
Name:"name",//名字 
ArmType:"armType",//类型(1猎人，2恐龙) 
Title:"title",//描述 
Scale:"scale",//缩放（10=1倍） 
PrefabPackage:"prefabPackage",//预制体所属分包 
ModelPackage:"modelPackage",//模型所属分包 
ModelPath:"modelPath",//模型路径 
TexturePath:"texturePath",//貼圖路径 
ArrowPackage:"arrowPackage",//弓箭所属分包 
ArrowPath:"arrowPath",//弓箭名称 
HpY:"hpY",//HP的高度 
Scale:"scale",//模型缩放 
ScaleArrow:"scaleArrow",//弓箭缩放 
PosArrow:"posArrow",//子弹发射/击中位置 
RotateArrow:"rotateArrow",//弓箭旋转 
ColliderCenter:"colliderCenter",//模型碰撞锚点 
ColliderSize:"colliderSize"//模型碰撞大小 
};//[dinoType]
jsonTables.CONFIG_DINOTYPE={Tid:"Tid",//兵种 
Name:"name",//名字 
ArmType:"armType",//类型(1猎人，2恐龙) 
Title:"title",//描述 
Scale:"scale",//缩放（10=1倍） 
ModelPackage:"modelPackage",//模型所属分包 
ModelPath:"modelPath",//模型路径 
TexturePath:"texturePath",//貼圖路径 
HpY:"hpY",//HP的高度 
Scale:"scale",//缩放 
PosArrow:"posArrow",//子弹击中位置 
ColliderCenter:"colliderCenter",//模型碰撞锚点 
ColliderSize:"colliderSize"//模型碰撞大小 
};//[human]
jsonTables.CONFIG_HUMAN={Tid:"Tid",//兵种编号 
Name:"name",//名字 
ArmType:"armType",//类型（1猎人，2恐龙） 
Type:"type",//类型2 
Quality:"quality",//品质(1普通，2变异) 
Exp:"exp",//掉落金币 
Attack:"attack",//攻击力 
Hp:"hp"//生命值 
};}).call(root);})(// The environment-specific global.
function(){if(typeof globalThis!=='undefined')return globalThis;if(typeof self!=='undefined')return self;if(typeof window!=='undefined')return window;if(typeof global!=='undefined')return global;if(typeof this!=='undefined')return this;return{};}.call(this));