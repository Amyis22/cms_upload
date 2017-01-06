
var casper = require('casper').create(/*{
	pageSettings: {
		// 冒充浏覽器
		userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X; en-us) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53'
	},
	// 浏覽器窗口大小
	viewportSize: {
		width: 320,
		height: 568
	}}*/);
casper.echo('hhaha');
// casper.start();
casper.start('http://wizard2.webdev.com', function () {
	console.log('ssss');
	casper.echo(casper.captureSelector);
	casper.captureSelector('baidu.png', 'html');

	casper.evaluate(function () {
		console.log('evaluate');
	});

});
casper.run();