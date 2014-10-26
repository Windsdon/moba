
$(window).load(function(){
	wengine.init();

	wengine.addResourceList("res/res.json");
	wengine.fileLoader.start(function(){
			$("<img/>").attr("src", wengine.getResource("image.logo.default").resource).appendTo($("body"));
		}, {}
	);
})
