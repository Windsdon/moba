var wengine = {	
	//////////////////////////////////

	babel: false,

	Babel: function(resource){

	},

	getString: function(key){
		if(!babel){
			console.warn("No Babel object!");
			return "<missing>";
		}else{
			return babel.getString(key);
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
			console.log("Loading file %O", file);
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
						e.data.context.res.resource = $(this).attr("src");
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
					success: function(data){
						this.res.resource = data;
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
				if(file.callback){
					file.callback.call(file.o, file.res);
				}
				file.res.loaded = true;
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
		console.log("queueing: %O", resource);
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
				if(this.resources[i].loaded){
					continue;
				}

				wengine.queueFile(this.resources[i]);
			}
			wengine.fileLoader.start();
		};

		this.addList = function(list){
			for(i in list){
				var item = list[i];
				this.insert(new wengine.Resource(item.id, item.url, item.type));
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
				console.log(resource);
				this.res.addList(resource.resource.resources);
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
		this.resource = false;
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