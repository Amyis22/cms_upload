var casper = require('casper').create({
    pageSettings: {
        userAgent: "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E)" 
}});
var fs = require('fs');
var content = fs.read('./paramObj');
var params = JSON.parse(content);
var waitTime = params.waitTime || 100;
fs.remove('./paramObj');

casper.echo(content);
casper.start(params.url.server, function () {casper.echo('c1:in-1');
    this.evaluate(function (username, password) {casper.echo('ci:in-2');
        $('#user_id').val(username);
        $('#user_pwd').val(password);
        $('#form_submit').click();
    }, params.username, params.password);
});
casper.echo('tttt');
/**
 * 跳转到urlpath
 * @param urlpath
 * @param log
 */
var redirectTo = function (urlpath, log) {
    casper.then(function () {
        if (log !== false) {
            this.echo('#green{redirect:} #yellow{[' + urlpath + ']}');
        }
        casper.evaluate(function (url) {
            window.location.href = url;
        }, urlpath);
    });
};
/**
 * 上传一个文件到指定目录
 * @param filePath
 */
var uploadOneFile = function (filePath) {
    casper.wait(1, function () {
        this.echo('#green{upload:} #yellow{[' + filePath + ']}');
        this.fill('form[name=form1]', {
            "upfile": filePath,
            "addmat": '1',
            'overwrite': params.overwrite ? '0' : '1'
        }, true);
    });

    casper.wait(waitTime, function () {
        var info = casper.evaluate(function () {
            return document.getElementById('top_tips').innerText;
        });
        this.echo(info);
    });
};
/**
 * 上传文件到 urlpath
 * @param files 上传文件列表
 * @param urlpath 上传文件路径
 */
var uploadFiles = function (urlpath, files) {
    redirectTo(urlpath);
    files.forEach(function (val) {
        uploadOneFile(val);
    });
};
/**
 * 新建文件夹
 * @param urlpath
 * @param dirs
 */
var addDirs = function (urlpath, dirs) {
    dirs.forEach(function (val, idx) {
        redirectTo(urlpath, false);
        addDeepDir(urlpath, val);
    });
};

/**
 * 在指定位置添加一个文件夹
 * @param urlpath
 * @param dirname
 */
var addOneDir = function (urlpath, dirname) {
    casper.wait(waitTime / 3, function () {
        casper.fill('form[name=form1]', {
            "name": dirname
        }, true);
        this.echo('#green{new dir:} #yellow{[' + urlpath + dirname + ']}');
    });
};
/**
 * 在指定位置 添加有纵深的文件夹
 * @param urlpath
 * @param dir
 */
var addDeepDir = function (urlpath, dir) {
    var dirarr = dir.split('/');
    var url = /\/$/.test(urlpath) ? urlpath : urlpath + '/';
    dirarr.forEach(function (val) {
        addOneDir(url, val);
        redirectTo(url + val + '/');
        url += val;
    });
};

/**
 * 等待登陆成功，跳转到体育频道
 */
 casper.echo('tttt2');
casper.waitFor(function check() {
    return this.evaluate(function (username) {
        return $('#user_name').html() === username;
    }, params.username);
}, function then() {casper.echo('c2:in-2');
    this.echo('login #yellow{CMS} success.');
    casper.evaluate(function (channel) {
        Passport.jump2Proj('TCMS', channel);
    }, params.channelId);
    this.echo('try to enter #yellow{' + params.channelName + '}.');
}, function timeout() {casper.echo('c2:in-3');
    this.echo("登录失败，请重新登录.").exit();
});
casper.echo('tttt3');
/**
 * 页面跳转成功后，检查 如果没有权限，给出提示
 */
casper.waitForSelector('#messageDiv', function () {//确保页面已经跳转
    this.echo('login #yellow{' + params.channelName + '} success.');
}, function () {//超时后，查看是否有权限问题
    this.echo(casper.evaluate(function () {
        return document.querySelector('#priv_tips .msg').innerText;
    }));
});
casper.echo('tttt4');
var serverDirs = Object.keys(params.__files);
var newDirServer = params.url.server + params.url.newDir;
var fileUploadServer = params.url.server + params.url.upload;
casper.echo('tttt5-3');
/**
 * 非发布状态下，上传文件到服务器
 * 上传状态下，只需要上传html文件
 */
if (!params.publishProject) {
    serverDirs.forEach(function (serverDir) {
        var subDirs = Object.keys(params.__files[serverDir]);//取出所有
        addDirs(newDirServer + serverDir, subDirs);
        subDirs.forEach(function (subDir) {
            uploadFiles(fileUploadServer + serverDir + ((subDir === '.') ? '' : subDir), params.__files[serverDir][subDir]);
        })
    });
}
casper.echo('tttt5-4-1');

/**
 * 查找htmlid号
 **/
var getHtmlIdThen = function (htmlurl, cb) {
    var htmlState = htmlurl.split(/\\|\//);
    var catalog = params.catalog;
    if (htmlState.length > 1) {
        catalog = htmlState[htmlState.length - 2]; //倒数第二个值是catalog
    }
    var htmlid;
    var htmlName = htmlState[htmlState.length - 1];
    redirectTo(params.url.server + params.url.htmlfilelist + 'p=1&t=&k=/' + htmlName + '.htm&s=' + catalog);//到达子栏目列表，查询 k
    casper.wait(1, function () {
        htmlid = casper.evaluate(function (pagename) {
            var pagereg = new RegExp('/' + pagename + '.htm$');
            var pageurl = document.querySelector('.dgd_table_tr_even:nth-child(1) td:nth-child(4)').innerText;
            if (pagereg.test(pageurl)) {
                return document.querySelector('.dgd_table_tr_even:nth-child(1) td:nth-child(8)').innerHTML.match(/id=(\d*)&.*/)[1];
            }
        }, htmlName);
    });
    casper.wait(1, function () {
        cb(htmlid);
    });
};
casper.echo('tttt5-4-2');
/**
 * 添加或修改html文件 htmlUrl。。。
 * @param htmlUrl
 */
var addOrUpdateHtml = function (htmlUrl) {
    var htmlState = htmlUrl.split(/\\|\//);
    var catalog = params.catalog;
    if (htmlState.length > 1) {
        catalog = htmlState[htmlState.length - 2]; //倒数第二个值是catalog
    }
    var htmlName = htmlState[htmlState.length - 1];
    getHtmlIdThen(htmlUrl, function (htmlid) {
        redirectTo(params.url.server + params.url.htmlfileserver, false);//跳转到新增或修改html文件的form表单页面
        casper.wait(1, function () {
            casper.evaluate(function (server) {
                document.forms[0].target = "_blank";
                document.forms[0].action = server;
            }, (htmlid !== null) ? params.url.htmlfileupdate : params.url.htmlfileadd);//简单判断，不是null，就是有值，这时候，执行覆盖操作
        });
        casper.wait(1, function () {
            if (params.htmlSafeAdd && htmlid !== null) { //安全模式下，如果发现已存在，不能更新
                this.echo('page #yellow{' + htmlUrl + '.htm} already exit, please check.');
                return;
            }
            var type = '0'; //是html的时候是0. 含有 xml 开头的时候是xslt的类型 是 1
            if (/^<\?xml.*\?>/.test(params.__htmls[htmlUrl])) {
                type = '1';
            }
            casper.fill('[name=_form]', {
                id: (htmlid !== null) ? htmlid : '',
                name: htmlName,
                jump: 1,
                async: 1,
                file: htmlName + '.htm',
                type: type,
                catalog: catalog,
                topic: params.topic,
                site: params.channelId,
                fpath: '',
                root: 'main',
                content: params.__htmls[htmlUrl]
            }, true);
            this.echo('page #yellow{' + htmlUrl + '.htm} ' + ((htmlid !== null) ? 'updated' : 'created') + '.');
        });
    });
};
casper.echo('tttt5-4-3');
/*var htmlFileIds = Object.keys(params.__htmls);
htmlFileIds.forEach(function (filename) {
    casper.wait(params.htmlWaitTime || 50, function () {
        addOrUpdateHtml(filename);
    });
});*/
casper.echo('tttt5-5');
//太早退出会造成http发送途中关闭浏览器，http任务失败，因此5秒钟后自动退出
casper.wait(5000, function () {
    casper.echo('all complete.').exit();
});

casper.run();
casper.echo('tttt6');