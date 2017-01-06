var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var cwd = process.cwd();
var config = require('./config.js');

var paramObj = config;
var filesToUpload = [];
var filesAndDirs = {};
var stdinReg = /\r|\n|\r\n/g;

process.stdin.setEncoding('utf-8');

//输入输出-online at a time
require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

//获得文件
var getFile = function () {
	var url = path.resolve(cwd, config.file); //获取解析完整后的路径
	console.log("url: ", url);
	var files = fs.readdirSync(config.dir); //获取目录下的文件数组；
	console.log("file: ", files);

	var stat = fs.statSync(url); //返回stat实例，判断数据类型
	console.log(stat.isFile());

	//是文件的情况
	if (stat.isFile() && filesToUpload.length <= 0) {
		filesToUpload.push(url);
	}

	collectionLocalFiles();
}

var baseRoot = "";
/**
 * 遍历本地文件夹下的所有文件
 * @param filedir
 */
var walkAllFiles = function (filedir) {
    var files = fs.readdirSync(filedir);

    files.forEach(function (url) {
        var fullUrl = path.join(filedir, url);
        var stat = fs.statSync(fullUrl);
        if (stat.isDirectory()) {
            walkAllFiles(fullUrl);
        }
        if (stat.isFile()) {
            var pass = true;
            paramObj.staticResourcesFileFilter.forEach(function (val) {
                if (val.test(fullUrl)) {
                    pass = false;
                }
            });
            var isHtml = url.match(/\.html|\.htm/);
            if (isHtml) {
                addToHtmlFiles(path.relative(baseRoot, fullUrl).replace(isHtml[0], '').replace(/\\|\//g, '/'), fullUrl);
            }
            if (pass) { //需要过滤掉的格式
                allFilesToUpload.push(fullUrl);
            }
        }
    });
};

/**
 * 收集本地需要上传的文件
 */
var collectionLocalFiles = function () {
    var localBases = Object.keys(config.staticResourcesMapping);
    localBases.forEach(function (val) {
        // allFilesToUpload = [];
        var url = path.resolve(cwd, val);
        // if (fs.existsSync(url)) {
        //     baseRoot = url;
        //     walkAllFiles(url);
        // }
        var serverDir = config.staticResourcesMapping[val];
        serverDir = /\/$/.test(serverDir) ? serverDir : serverDir + '/';
        if (filesAndDirs[serverDir] === undefined) {
            filesAndDirs[serverDir] = {};
        }
        var thisMapping = filesAndDirs[serverDir];
        filesToUpload.forEach(function (val) {
            var shortDir = path.dirname(path.relative(url, val)).replace(/\\/, '/');
            if (thisMapping[shortDir] === undefined) {
                thisMapping[shortDir] = [];
            }
            thisMapping[shortDir].push(val);
        });
    });
    paramObj.__files = filesAndDirs;

    console.log(12, paramObj.__files);
};

/**
 * 输入一个字符串
 * @param query
 * @param callback
 */
var stdOnce = function (query, callback) {
	var stdin = process.openStdin();
	var all = '';
	process.stdout.write(query);
	var hidepass = function (char) {
		char = char + "";
		all += char;
		switch (char) {
			case "\n":
			case "\r":
			case "\u0003": //end of text
				stdin.removeListener('data', hidepass);
				if (callback != undefined) {
					callback(all);
				}
				break;
			case "\u0004": //end of transmission \n
				stdin.pause();
				break;
			default:
				if (paramObj.username === undefined) { //用户名时向后移动
					process.stdout.write('');
				} else {
					process.stdout.write('\033[1D'); //不移动光标
				}

				break;
		}
	}

	process.stdin.on('data', hidepass);
}

/**
 * 获取caperjs:
 */
var getCasperjs = function () {
	var cpath = path.resolve(__dirname, '../node_modules/casperjs/bin/casperjs');
	try {
		fs.readFileSync(cpath);
	} catch (e) {
		cpath = path.resolve('../../casperjs/bin/casperjs');
	}

	return cpath;
}

/**
 * 开始上传
 */
var run = function () {
	getFile();
	console.log('dirname:', __dirname); //执行文件的当前路径
	stdOnce('username : ', function (username) {
		paramObj.username = username.replace(stdinReg, '');
		stdOnce('password : ', function (password) {
			paramObj.password = password.replace(stdinReg, '');
			fs.writeFileSync('./paramObj', JSON.stringify(paramObj));

			var execArgs = [path.resolve(__dirname, './cms_casperjs.js')]; //cms_caperjs的路径
			// var execArgs = [path.resolve(__dirname, './testCasper.js')]; //test-> casperjs lib/testCasper.js
			var casperjs = spawn(getCasperjs(), execArgs);

			casperjs.stdout.setEncoding('utf8');
			casperjs.stdout.on('data', function (data) {
				console.info('data:', data);
				if (/all complete/.test(data)) {
					process.exit();
				}
				if (/登录失败，请重新登录/.test(data)) {
					paramObj.username = undefined;
					run();
				}
			});
			casperjs.stdout.on('exit', function (code) {
				console.log('exit:',code);
/*				if (code != 0) {
					console.log('Failed: ' + code);
				}*/
			});
		});
	});
}

run();