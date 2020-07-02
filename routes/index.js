const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
// 引入 SDK
const crawlab = require('crawlab-sdk');

(async (url, options) => {


	//检索语句
	let key = '((ts:(Superconducting) AND ipc:(B82Y10/00)) OR (ts:(Superconducting) AND ipc:(H01L31)) ' +
		'OR (ts:(Superconducting) AND ipc:(H01L21)) ' +
		'OR (ts:(Superconducting) AND ipc:(G11C11/16)) ' +
		'OR (ts:(Superconducting) AND ipc:(06N99/00)) ' +
		'OR (ts:(Superconducting) AND ipc:(G06N99)) ' +
		'OR (ts:(Circuits) AND ipc:(H01L39/24)) ' +
		'OR (ts:(Circuits) AND ipc:(G01R33/035)) ' +
		'OR (ts:(superconducting) AND ipc:(H01L23/532)) ' +
		'OR (ts:(Josephson) AND ipc:(H01L39/22)) ' +
		'OR (ipc:(H01L39/06)) ' +
		'OR (ipc:(G11C11/44)) ' +
		'OR (ipc:(G11C11/16)) ' +
		'OR (ipc:(G11C19/32)) ' +
		'OR (ipc:(H01L27/18)) ' +
		'OR (ipc:(H01L39/00)) ' +
		'OR (ipc:(H01L39/02)) ' +
		'OR (ts:(Superconducting computer)) ' +
		'OR (ts:(SFQ)) ' +
		'OR (ts:(Josephson junction)) ' +
		'OR (ts:(Superconducting Circuits)) ' +
		'OR (ts:(Superconducting CPU)) ' +
		'OR (ts:(Cryogenic memory))) ' +
		'AND (ay:[2019 TO 2020]) AND NOT (countryCode:CN)' ;


	//数据库配置选项
	let DBoptions = {
		db_user: "root",//添加的普通账户名
		db_pwd: "123456",
		db_host: "127.0.0.1",
		db_port: 27017,
		db_name: "test",//数据库名称
		useNewUrlParser: true
	};
	// 连接数据库
	const dbURL = "mongodb://" + DBoptions.db_user + ":" + DBoptions.db_pwd + "@" + DBoptions.db_host + ":" + DBoptions.db_port + "/" + DBoptions.db_name+"?authSource=admin";
	mongoose.connect(dbURL,{ useNewUrlParser: true, useUnifiedTopology: true },(error)=>{
		if(error){
			throw error
		}else{
			console.log( '数据库已连接')
		}
	});

	//创建数据库骨架
	const Schema = mongoose.Schema;
	const itemSchema = new Schema({
		CPC: String,
		IPC: String,
		agency: String,
		agent: String,
		applicant: String,
		applicantAddress: String,
		applicationDate: String,
		applicationNumber: String,
		assignee: String,
		currentAssignee: String,
		documentDate: String,
		documentNumber: {
			type: String,
			unique: true
		},
		inventor: String,
		summary: String,
		title: String
	});
	//创建数据库模型和实体
	let itemModel = mongoose.model('items',itemSchema);

	//设置浏览器

	console.log("打开浏览器成功!");

	const browser = await puppeteer.launch({
		headless: true  // 关闭无头模式
	});

	//打开页面
	const loginPage = await browser.newPage();
	await loginPage.goto('https://www.iprabc.com/user/login.html', options);
	console.log("已打开登录页");

	/**
	 * # 需要注册一个新的账号 此账号被冻结了（此网站爬取频率太快 很容易被冻结）
	 * self.driver.find_element_by_id('account').send_keys('17158818001')
	 * self.driver.find_element_by_id('password').send_keys('lqm19950604')
	 */
	//登录页面操作
	const account = '13859994938';
	const password = 'sungoddess';
	await loginPage.type('#account',account,{delay: 0});   //输入帐号
	await loginPage.type('#password',password,{delay: 0}); //输入密码

	//点击登录后等待页面加载
	const loginButton = await loginPage.$("body > div > div:nth-child(8) > div.loginMainBox > div > div > div.main_right > div > div.layui-tab-content.box_main > div > div > div:nth-child(5) > button");
	await loginButton.click();

	//使用pages打开跳转后的页面
	let pages = await browser.pages();
	const searchPage = pages[1];
	console.log("已打开搜索页");

	//输入框输入查询条件并点击查询
	await searchPage.waitFor(5000);
	await searchPage.type('#q',key,{delay: 0}); //key为查询条件
	const searchButton = await searchPage.$('body > div > div:nth-child(6) > div.header1.headerSize > div > div.top_search.search > div.searchInp > form > button');
	await searchButton.click();

	//使用pages打开跳转后的页面
	pages = await browser.pages();
	const resultPage = pages[1];
	await resultPage.waitForNavigation();
	console.log("已打开第1页搜索结果");

	/**
	 * 数据爬取示例
	 * 'CPC': '',
	 * 'IPC': 'H01L43/12 , H01L27/22 , G11C11/16',
	 * 'agency': '',
	 * 'agent': '陳長文',
	 * 'applicant': '日商東芝記憶體股份有限公司',
	 * 'applicantAddress': '',
	 * 'applicationDate': '2019-01-22',
	 * 'applicationNumber': 'TW108102393',
	 * 'assignee': '日商東芝記憶體股份有限公司',
	 * 'currentAssignee': '日商東芝記憶體股份有限公司',
	 * 'documentDate': '2020-06-01',
	 * 'documentNumber': 'TWI695524B',
	 * 'inventor': ' 伊藤雄一 , ITO, YUICHI , 松尾浩司 , MATSUO, KOUJI',
	 * 'summary': '',
	 * 'title': '磁性記憶裝置及其製造方法'
	 */

	await resultPage.waitFor(5000);
	//找到所有的页面之后保存该页的所有信息内容在items中，items中每一项都是一个专利项目
	let items =await resultPage.$x('//*[contains(@class, "ui items")]');

	/**
	 * 当前问题：
	 * 如果是关键字搜索，网页中会出现highlight高亮导致获取文字不完整
	 * 搜索示例中的方式直接搜索则不会出现highlight高亮
	 *
	 * 未测试！！！！！
	 */
	let flag;
	let i = 1;
	if(items){
		flag = 1;
	}else{
		flag = 0;
	}

	while (flag) {
		console.log("开始爬取第"+i+"页搜索结果");
		//保存该页信息
		for (let k = 0; k < items.length; k++) {

			let item = items[k];

			//数据项实例
			let itemInstance = new itemModel();

			//设置封装数据项
			let object = {
				CPC: await Promise.resolve(item.$$eval('span[data-property=\'cpc\']', el => el.map(text => text.innerText))),
				IPC: await Promise.resolve(item.$$eval('span[data-property=\'ipc\']', el => el.map(text => text.innerText))),
				agency: await Promise.resolve(item.$$eval('span[data-property=\'agency\']', el => el.map(text => text.innerText))),
				agent: await Promise.resolve(item.$$eval('span[data-property=\'agent\']', el => el.map(text => text.innerText))),
				applicant: await Promise.resolve(item.$$eval('span[data-property=\'applicant\']', el => el.map(text => text.innerText))),
				applicantAddress: await Promise.resolve(item.$$eval('span[data-property=\'applicationAddress\']', el => el.map(text => text.innerText))),
				applicationDate: await Promise.resolve(item.$$eval('span[data-property=\'applicationDate\']', el => el.map(text => text.innerText))),
				applicationNumber: await Promise.resolve(item.$$eval('span[data-property=\'applicationNumber\']', el => el.map(text => text.innerText))),
				assignee: await Promise.resolve(item.$$eval('span[data-property=\'assignee\']', el => el.map(text => text.innerText))),
				currentAssignee: await Promise.resolve(item.$$eval('span[data-property=\'currentAssignee\']', el => el.map(text => text.innerText))),
				documentDate: await Promise.resolve(item.$$eval('span[data-property=\'documentDate\']', el => el.map(text => text.innerText))),
				documentNumber: await Promise.resolve(item.$$eval('span[data-property=\'documentNumber\']', el => el.map(text => text.innerText))),
				inventor: await Promise.resolve(item.$$eval('span[data-property=\'inventor\']', el => el.map(text => text.innerText))),
				summary: await Promise.resolve(item.$$eval('span[data-property=\'summary\']', el => el.map(text => text.innerText))),
				title: await Promise.resolve(item.$$eval("span[data-property=\'title\']", el => el.map(text => text.innerText))),
			};

			itemInstance.CPC = object.CPC[0];
			for(let i=1;i<object.CPC.length;i++){
				itemInstance.CPC += ","+object.CPC[i];
			}
			itemInstance.IPC = object.IPC[0];
			for(let i=1;i<object.IPC.length;i++){
				itemInstance.IPC += ","+object.IPC[i];
			}
			itemInstance.agency = object.agency[0];
			for(let i=1;i<object.agency.length;i++){
				itemInstance.agency += ","+object.agency[i];
			}
			itemInstance.agent = object.agent[0];
			for(let i=1;i<object.agent.length;i++){
				itemInstance.agent += ","+object.agent[i];
			}
			itemInstance.applicant = object.applicant[0];
			for(let i=1;i<object.applicant.length;i++){
				itemInstance.applicant += ","+object.applicant[i];
			}
			itemInstance.applicantAddress = object.applicantAddress[0];
			for(let i=1;i<object.applicantAddress.length;i++){
				itemInstance.applicantAddress += ","+object.applicantAddress[i];
			}
			itemInstance.applicationDate = object.applicationDate[0];
			for(let i=1;i<object.applicationDate.length;i++){
				itemInstance.applicationDate += ","+object.applicationDate[i];
			}
			itemInstance.applicationNumber = object.applicationNumber[0];
			for(let i=1;i<object.applicationNumber.length;i++){
				itemInstance.applicationNumber += ","+object.applicationNumber[i];
			}
			itemInstance.assignee = object.assignee[0];
			for(let i=1;i<object.assignee.length;i++){
				itemInstance.assignee += ","+object.assignee[i];
			}
			itemInstance.currentAssignee = object.currentAssignee[0];
			for(let i=1;i<object.currentAssignee.length;i++){
				itemInstance.currentAssignee += ","+object.currentAssignee[i];
			}
			itemInstance.documentDate = object.documentDate[0];
			for(let i=1;i<object.documentDate.length;i++){
				itemInstance.documentDate += ","+object.documentDate[i];
			}
			itemInstance.documentNumber = object.documentNumber[0];
			for(let i=1;i<object.documentNumber.length;i++){
				itemInstance.documentNumber += ","+object.documentNumber[i];
			}
			itemInstance.inventor = object.inventor[0];
			for(let i=1;i<object.inventor.length;i++){
				itemInstance.inventor += ","+object.inventor[i];
			}
			itemInstance.summary = object.summary[0];
			for(let i=1;i<object.summary.length;i++){
				itemInstance.summary += ","+object.summary[i];
			}
			itemInstance.title = object.title[0];
			for(let i=1;i<object.title.length;i++){
				itemInstance.title += ","+object.title[i];
			}
			// 调用保存结果方法
			await crawlab.saveItem(itemInstance);
			itemInstance.save(function (err) {
				if(err){
					console.log(err);
					console.log("第"+i+"页第"+(k+1)+"项保存失败!");
				}
			});
		}

		//每页处理完毕之后根据是否有下一页按钮选择是否进入下一页
		/**
		 *  当前问题：
		 *  如果搜索到的内容不到十页，下一页出现的位置就不在第11/12位，
		 *  需要找到一个函数能够判断页面中是否有第i页的按钮
		 *
		 *  暂时解决办法：(未测试)
		 *  找到点击下一页的按钮图标
		 *  找到的话说明存在下一页的按钮，即有下一页
		 *  否则不存在下一页
		 */
		i++;
		let next = await resultPage.$('.right.arrow.icon');
		if (next) {
			await next.click();
			pages = await browser.pages();
			let nextPage = pages[1];
			nextPage.waitFor(2000);
			await nextPage.waitForNavigation();
			console.log("已打开第"+i+"页搜索结果");
			items = nextPage.$x('//*[contains(@class, "ui items")]');
		} else {
			flag = 0;
		}
	}

	console.log("爬虫结束");
	//关闭网页
	await browser.close();

	//结束，退出
	process.exit();
})();
