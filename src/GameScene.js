
import TitleScene from './TitleScene.js';

var GameScene = cc.Scene.extend({
  onEnter: function() {
    this._super();
    //this.setTouchEnabled(true);
    var size = cc.director.getWinSize();
    var sprite = cc.Sprite.create("res/HelloWorld.png");
    sprite.setPosition(size.width / 2, size.height / 2);
    sprite.setScale(0.8);
    this.addChild(sprite, 0);

    var label = cc.LabelTTF.create("game", "Arial", 40);
    var button = new cc.MenuItemLabel(label, this.startGame, this);
    //var button = new cc.MenuItemFont("start",this.startGame,this);
    button.setPosition(size.width / 2, size.height / 2 - 200);
    button.setColor(cc.color("#FFFFFF"));
    var menu = new cc.Menu(button);
    menu.x = 0;
    menu.y = 0;
    this.addChild(menu);
  },

  startGame(target) {
	console.log("touch");
	var delay = cc.delayTime(0.5);
	// ゲームを始めるアクション
	var startGame = cc.callFunc(function() {
        var scene = new TitleScene();
        var transition = new cc.TransitionFadeBL(0.5, scene, true);
		cc.director.runScene(transition);
	}, this);
	this.runAction(cc.sequence(delay,
							   startGame))
  }
});

export default GameScene;