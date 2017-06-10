# Cocos2d-JS Minimal Starter

This starter doesn't use any Javascript technology except for cocos2d-js. 
So you no longer hassle with day-by-day advance of js tools. 
You can focus on only cocos2 and your game's idea !

# how to start

```
$ npm install -g browser-sync
$ browser-sync start --server --files *.js src/*.js
```

If you want to upgrade cocos2d version, you can download the following page.
http://cocos2d-x.org/filecenter/jsbuilder/

Then, move downloaded cocos2d-js-vX.XX.js to lib directory.

# how to deploy gh-pages

Create gh-pages branch and push it.

```
$ git checkout -b gh-pages
$ git commit # do something
# git push origin gh-pages
```

Now, you can see https://iwag.github.io/cocos2d-js-minimal-starter/
