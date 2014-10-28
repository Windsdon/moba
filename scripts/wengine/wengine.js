var wengine = {	
	//////////////////////////////////

	babel: false,

	//resource: the localelist
	Babel: function(resource){
		this.languages = {};

		this.selected = false;

		this.languageCallback = function(resource){
			this.languages[resource.id.match(/language.(.*)/)[1]] = resource.data;
		};

		this.getString = function(key){
			if(!this.selected){
				console.warn("No language selected!");
				return "<missing>";
			}
			if(!this.languages[this.selected]){
				console.warn("Language %s doesn't exist!", this.selected);
				return "<missing>";
			}
			return this.getStringFromLang(key, this.selected);
		};

		this.getStringFromLang = function(key, lang){
			var l = this.languages[lang];
			if(!l[key]){
				console.warn("Language %s doesn't define %s!", lang, key);
				return "<missing>";
			}

			return l[key];
		}

		if(resource.loaded){
			for(i in resource.data.locales){
				var locale = resource.data.locales[i];
				console.log("Found language: %s", locale.name);
				if(locale["default"]){
					this.selected = locale.code;
				}
				var res = new wengine.Resource(
					"language." + locale.code,
					"res/locale/strings/"+locale.code+".json",
					"language"
				);
				res.callback = this.languageCallback;
				res.context = this;
				wengine.res.insert(res);
				wengine.res.loadAll();
			}
		}
	},

	getString: function(key){
		if(!this.babel){
			console.warn("No Babel object!");
			return "<missing>";
		}else{
			return this.babel.getString(key);
		}
	},

	//////////////////////////////////

	fileLoader: false,

	FileLoader: function(maxParallel){
		this.maxParallel = maxParallel ? maxParallel : 1;
		this.loadQueue = new Array();
		this.loading = new Array();
		this.maxAttempts = 2;
		this.totalLoaded = 0;

		this.queueFile = function(resource, callback, context){
			if(!callback){
				var callback = false;
				var context = false;
			}

			for(i in this.loadQueue){
				if(this.loadQueue[i].res == resource){
					return false;
				}
			}

			for(i in this.loading){
				if(this.loading[i].res == resource){
					return false;
				}
			}

			var file = {
				res: resource,
				callback: callback,
				o: context,
				success: false,
				attempts: 0,
				loader: wengine.fileLoader
			};

			this.loadQueue.unshift(file);

			return file;
		};

		this.start = function(callback, o){
			this.loadNext();
			if(!!callback && !!o){
				this.completeAction = {
					o: o,
					callback: callback
				}
			}
		}

		// returns true if the file is already loaded
		this.loadFile = function(file){
			// console.log("Loading file %O", file);
			if(file.res.loaded){
				return true;
			}

			file.attempts++;

			if(file.res.type == "image"){
				$("<img/>").attr("src", file.res.url)
				.load(
					{
						context: file
					},
					function(e){
						e.data.context.res.data = $(this).attr("src");
						e.data.context.success = true;
						e.data.context.loader.onFileLoaded(e.data.context);
					}
				)
				.error(
					{
						context: file
					},
					function(e){
						e.data.context.success = false;
						e.data.context.loader.onFileLoaded(e.data.context);
					}
				);
			}else{
				$.ajax({
					url: file.res.url,
					context: file,
					cache: false,
					success: function(data){
						this.res.data = data;
					},
					complete: function(a, status){
						if(status != "success"){
							this.success = false;
						} else {
							this.success = true;
						}

						this.loader.onFileLoaded(this);
					}
				});
				
			}

			if(this.loading.indexOf(file) == -1){
				this.loading.push(file);
			}

			return false;
		};

		// procs callbacks and queues the next file
		this.onFileLoaded = function(file){
			if(file.success){
				file.res.loaded = true;
				if(file.callback){
					file.callback.call(file.o, file.res);
				}
				this.totalLoaded++;
				this.loading.splice(this.loading.indexOf(file), 1);
				this.loadNext();
				return true;
			}else{
				console.warn("Could not load file %s (Attempt %d)", file.res.url, file.attempts);
				if(file.attempts > this.maxAttempts){
					console.warn("Giving up");
					this.loading.splice(this.loading.indexOf(file), 1);
					if(!this.loadNext()){
						if(!!this.completeAction){
							this.completeAction.callback.call(this.completeAction.o);
						}
					}
					return false;
				}else{
					this.loadFile(file);
				}
			}
		}

		// Load next unloaded file. False if finished
		this.loadNext = function(){
			if(this.loading.length >= this.maxParallel){
				return true;
			}
			do {
				if(this.loadQueue.length == 0){
					return false;
				}
				var file = this.loadQueue.pop();
			} while(this.loadFile(file));

			return true;
		}
	},

	queueFile: function(resource, callback, context){
		// console.log("queueing: %O", resource);
		if(!this.fileLoader){
			console.error("File loader doesn't exist!");
			return false;
		}
		return this.fileLoader.queueFile(resource, callback, context);
	},

	//////////////////////////////////

	res: false,

	ResourceList: function(){
		this.resources = {};
		this.autoLoadLocale = false;

		this.get = function(key){
			if(typeof this.resources[key] == "undefined"){
				console.warn("Could not find resource \"%s\"", key);
				return false;
			}else{
				var resource = this.resources[key];
				if(!resource.loaded){
					console.warn("Resource \"%s\" found, but not yet loaded", key);
					return false;
				}else{
					return resource;
				}
			}
		};

		this.insert = function(resource){
			this.resources[resource.id] = resource;
		};

		this.loadAll = function(){
			for(i in this.resources){
				var r = this.resources[i];
				if(r.loaded){
					continue;
				}
				if(this.autoLoadLocale && r.type == "localelist"){
					wengine.queueFile(r, function(res){
						wengine.babel = new wengine.Babel(res);
					}, {});
				}else{
					if(r.callback){
						wengine.queueFile(r, r.callback, r.context);
					}else{
						wengine.queueFile(r);
					}
				}
			}
			wengine.fileLoader.start();
		};

		this.addList = function(list){
			for(i in list){
				var item = list[i];
				this.insert(new wengine.Resource(item.id, item.url, item.type));
			}
		};

		this.setAutoLoadLocale = function(b){
			if(b){
				this.autoLoadLocale = true;
			}else{
				this.autoLoadLocale = false;
			}
		}
	},

	getResource: function(key){
		if(!this.res){
			console.error("Resource list doesn't exist!");
			return false;
		}
		return this.res.get(key);
	},

	addResourceList: function(url){
		this.queueFile(
			new wengine.Resource("resourcelist", url, "resourcelist"), 
			function(resource){
				// console.log(resource);
				this.res.addList(resource.data.resources);
				this.res.loadAll();
			},
			this
		);
	},

	Resource: function(id, url, type){
		this.id = id;
		this.url = url;
		this.type = type;
		this.loaded = false;
		this.data = false;
	},



	//////////////////////////////////

	canvas: false,

	createCanvas: function(){
		return $("<canvas/>")[0];
	},

	//////////////////////////////////

	init: function(params){
		console.log("wengine is now loading...");

		if(!$){
			console.error("jQuery not found!");
			return false;
		}

		if(!params){
			console.warn("No params were given!\nLoading default configurations");

			canvas = this.createCanvas();
		}

		this.fileLoader = new this.FileLoader();
		this.res = new this.ResourceList();

		return true;
	}
}