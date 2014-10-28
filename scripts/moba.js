
$(window).load(function(){
	wengine.init();

	wengine.res.setAutoLoadLocale(true);
	wengine.addResourceList("res/res.json");
	wengine.fileLoader.start(function(){
			$("<img/>").attr("src", wengine.getResource("image.logo.default").data).appendTo($("body"));
			document.title = wengine.getString("moba.name");
			debugger;
		}, window
	);
})
