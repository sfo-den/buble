import EventEmitter from "event-emitter";
import { extend, defer, isFloat } from "./utils/core";
import Hook from "./utils/hook";
import EpubCFI from "./epubcfi";
import Queue from "./utils/queue";
import Layout from "./layout";
import Mapping from "./mapping";
import Themes from "./themes";
import Contents from "./contents";

/**
 * [Rendition description]
 * @class
 * @param {Book} book
 * @param {object} options
 * @param {int} options.width
 * @param {int} options.height
 * @param {string} options.ignoreClass
 * @param {string} options.manager
 * @param {string} options.view
 * @param {string} options.layout
 * @param {string} options.spread
 * @param {int} options.minSpreadWidth overridden by spread: none (never) / both (always)
 */
class Rendition {
	constructor(book, options) {

		this.settings = extend(this.settings || {}, {
			width: null,
			height: null,
			ignoreClass: "",
			manager: "default",
			view: "iframe",
			flow: null,
			layout: null,
			spread: null,
			minSpreadWidth: 800
		});

		extend(this.settings, options);

		if (typeof(this.settings.manager) === "object") {
			this.manager = this.settings.manager;
		}

		this.viewSettings = {
			ignoreClass: this.settings.ignoreClass
		};

		this.book = book;

		this.views = null;

		/**
		 * Adds Hook methods to the Rendition prototype
		 * @property {Hook} hooks
		 */
		this.hooks = {};
		this.hooks.display = new Hook(this);
		this.hooks.serialize = new Hook(this);
		/**
		 * @property {method} hooks.content
		 * @type {Hook}
		 */
		this.hooks.content = new Hook(this);
		this.hooks.layout = new Hook(this);
		this.hooks.render = new Hook(this);
		this.hooks.show = new Hook(this);

		this.hooks.content.register(this.handleLinks.bind(this));
		this.hooks.content.register(this.passEvents.bind(this));
		this.hooks.content.register(this.adjustImages.bind(this));

		// this.hooks.display.register(this.afterDisplay.bind(this));
		this.themes = new Themes(this);

		this.epubcfi = new EpubCFI();

		this.q = new Queue(this);

		this.q.enqueue(this.book.opened);

		// Block the queue until rendering is started
		this.starting = new defer();
		this.started = this.starting.promise;
		this.q.enqueue(this.start);
	}

	/**
	 * Set the manager function
	 * @param {function} manager
	 */
	setManager(manager) {
		this.manager = manager;
	}

	/**
	 * Require the manager from passed string, or as a function
	 * @param  {string|function} manager [description]
	 * @return {method}
	 */
	requireManager(manager) {
		var viewManager;

		// If manager is a string, try to load from register managers,
		// or require included managers directly
		if (typeof manager === "string") {
			// Use global or require
			viewManager = typeof ePub != "undefined" ? ePub.ViewManagers[manager] : undefined; //require("./managers/"+manager);
		} else {
			// otherwise, assume we were passed a function
			viewManager = manager;
		}

		return viewManager;
	}

	/**
	 * Require the view from passed string, or as a function
	 * @param  {string|function} view
	 * @return {view}
	 */
	requireView(view) {
		var View;

		if (typeof view == "string") {
			View = typeof ePub != "undefined" ? ePub.Views[view] : undefined; //require("./views/"+view);
		} else {
			// otherwise, assume we were passed a function
			View = view;
		}

		return View;
	}

	/**
	 * Start the rendering
	 * @return {Promise} rendering has started
	 */
	start(){

		if(!this.manager) {
			this.ViewManager = this.requireManager(this.settings.manager);
			this.View = this.requireView(this.settings.view);

			this.manager = new this.ViewManager({
				view: this.View,
				queue: this.q,
				request: this.book.load.bind(this.book),
				settings: this.settings
			});
		}

		// Parse metadata to get layout props
		this.settings.globalLayoutProperties = this.determineLayoutProperties(this.book.package.metadata);

		this.flow(this.settings.globalLayoutProperties.flow);

		this.layout(this.settings.globalLayoutProperties);

		// Listen for displayed views
		this.manager.on("added", this.afterDisplayed.bind(this));

		// Listen for resizing
		this.manager.on("resized", this.onResized.bind(this));

		// Listen for scroll changes
		this.manager.on("scroll", this.reportLocation.bind(this));


		this.on("displayed", this.reportLocation.bind(this));

		// Trigger that rendering has started
		this.emit("started");

		// Start processing queue
		this.starting.resolve();
	}

	/**
	 * Call to attach the container to an element in the dom
	 * Container must be attached before rendering can begin
	 * @param  {element} element to attach to
	 * @return {Promise}
	 */
	attachTo(element){

		return this.q.enqueue(function () {

			// Start rendering
			this.manager.render(element, {
				"width"  : this.settings.width,
				"height" : this.settings.height
			});

			// Trigger Attached
			this.emit("attached");

		}.bind(this));

	}

	/**
	 * Display a point in the book
	 * The request will be added to the rendering Queue,
	 * so it will wait until book is opened, rendering started
	 * and all other rendering tasks have finished to be called.
	 * @param  {string} target Url or EpubCFI
	 * @return {Promise}
	 */
	display(target){

		return this.q.enqueue(this._display, target);

	}

	/**
	 * Tells the manager what to display immediately
	 * @private
	 * @param  {string} target Url or EpubCFI
	 * @return {Promise}
	 */
	_display(target){
		var isCfiString = this.epubcfi.isCfiString(target);
		var displaying = new defer();
		var displayed = displaying.promise;
		var section;
		var moveTo;

		// Check if this is a book percentage
		if (this.book.locations.length && isFloat(target)) {
			target = this.book.locations.cfiFromPercentage(target);
		}

		section = this.book.spine.get(target);

		if(!section){
			displaying.reject(new Error("No Section Found"));
			return displayed;
		}

		// Trim the target fragment
		// removing the chapter
		if(!isCfiString && typeof target === "string" &&
			target.indexOf("#") > -1) {
			moveTo = target.substring(target.indexOf("#")+1);
		}

		if (isCfiString) {
			moveTo = target;
		}

		return this.manager.display(section, moveTo)
			.then(function(){
				// this.emit("displayed", section);
			}.bind(this));

	}

	/*
	render(view, show) {

		// view.onLayout = this.layout.format.bind(this.layout);
		view.create();

		// Fit to size of the container, apply padding
		this.manager.resizeView(view);

		// Render Chain
		return view.section.render(this.book.request)
			.then(function(contents){
				return view.load(contents);
			}.bind(this))
			.then(function(doc){
				return this.hooks.content.trigger(view, this);
			}.bind(this))
			.then(function(){
				this.layout.format(view.contents);
				return this.hooks.layout.trigger(view, this);
			}.bind(this))
			.then(function(){
				return view.display();
			}.bind(this))
			.then(function(){
				return this.hooks.render.trigger(view, this);
			}.bind(this))
			.then(function(){
				if(show !== false) {
					this.q.enqueue(function(view){
						view.show();
					}, view);
				}
				// this.map = new Map(view, this.layout);
				this.hooks.show.trigger(view, this);
				this.trigger("rendered", view.section);

			}.bind(this))
			.catch(function(e){
				this.trigger("loaderror", e);
			}.bind(this));

	}
	*/

	/**
	 * Report what has been displayed
	 * @private
	 * @param  {*} view
	 */
	afterDisplayed(view){
		this.hooks.content.trigger(view.contents, this);
		this.emit("rendered", view.section);
		this.reportLocation();
	}

	/**
	 * Report resize events and display the last seen location
	 * @private
	 */
	onResized(size){

		if(this.location) {
			this.display(this.location.start);
		}

		this.emit("resized", {
			width: size.width,
			height: size.height
		});

	}

	/**
	 * Move the Rendition to a specific offset
	 * Usually you would be better off calling display()
	 * @param {object} offset
	 */
	moveTo(offset){
		this.manager.moveTo(offset);
	}

	/**
	 * Go to the next "page" in the rendition
	 * @return {Promise}
	 */
	next(){
		return this.q.enqueue(this.manager.next.bind(this.manager))
			.then(this.reportLocation.bind(this));
	}

	/**
	 * Go to the previous "page" in the rendition
	 * @return {Promise}
	 */
	prev(){
		return this.q.enqueue(this.manager.prev.bind(this.manager))
			.then(this.reportLocation.bind(this));
	}

	//-- http://www.idpf.org/epub/301/spec/epub-publications.html#meta-properties-rendering
	/**
	 * Determine the Layout properties from metadata and settings
	 * @private
	 * @param  {object} metadata
	 * @return {object} properties
	 */
	determineLayoutProperties(metadata){
		var properties;
		var layout = this.settings.layout || metadata.layout || "reflowable";
		var spread = this.settings.spread || metadata.spread || "auto";
		var orientation = this.settings.orientation || metadata.orientation || "auto";
		var flow = this.settings.flow || metadata.flow || "auto";
		var viewport = metadata.viewport || "";
		var minSpreadWidth = this.settings.minSpreadWidth || metadata.minSpreadWidth || 800;

		if (this.settings.width >= 0 && this.settings.height >= 0) {
			viewport = "width="+this.settings.width+", height="+this.settings.height+"";
		}

		properties = {
			layout : layout,
			spread : spread,
			orientation : orientation,
			flow : flow,
			viewport : viewport,
			minSpreadWidth : minSpreadWidth
		};

		return properties;
	}

	// applyLayoutProperties(){
	// 	var settings = this.determineLayoutProperties(this.book.package.metadata);
	//
	// 	this.flow(settings.flow);
	//
	// 	this.layout(settings);
	// };

	/**
	 * Adjust the flow of the rendition to paginated or scrolled
	 * (scrolled-continuous vs scrolled-doc are handled by different view managers)
	 * @param  {string} flow
	 */
	flow(flow){
		var _flow = flow;
		if (flow === "scrolled-doc" || flow === "scrolled-continuous") {
			_flow = "scrolled";
		}

		if (flow === "auto" || flow === "paginated") {
			_flow = "paginated";
		}

		if (this._layout) {
			this._layout.flow(_flow);
		}

		if (this.manager) {
			this.manager.updateFlow(_flow);
		}
	}

	/**
	 * Adjust the layout of the rendition to reflowable or pre-paginated
	 * @param  {object} settings
	 */
	layout(settings){
		if (settings) {
			this._layout = new Layout(settings);
			this._layout.spread(settings.spread, this.settings.minSpreadWidth);

			this.mapping = new Mapping(this._layout);
		}

		if (this.manager && this._layout) {
			this.manager.applyLayout(this._layout);
		}

		return this._layout;
	}

	/**
	 * Adjust if the rendition uses spreads
	 * @param  {string} spread none | auto (TODO: implement landscape, portrait, both)
	 * @param  {int} min min width to use spreads at
	 */
	spread(spread, min){

		this._layout.spread(spread, min);

		if (this.manager.isRendered()) {
			this.manager.updateLayout();
		}
	}

	/**
	 * Report the current location
	 * @private
	 */
	reportLocation(){
		return this.q.enqueue(function(){
			var location = this.manager.currentLocation();
			if (location && location.then && typeof location.then === "function") {
				location.then(function(result) {
					this.location = result;

					this.percentage = this.book.locations.percentageFromCfi(result);
					if (this.percentage != null) {
						this.location.percentage = this.percentage;
					}

					this.emit("locationChanged", this.location);
				}.bind(this));
			} else if (location) {
				this.location = location;
				this.percentage = this.book.locations.percentageFromCfi(location);
				if (this.percentage != null) {
					this.location.percentage = this.percentage;
				}

				this.emit("locationChanged", this.location);
			}

		}.bind(this));
	}

	/**
	 * Get the Current Location CFI
	 * @return {EpubCFI} location (may be a promise)
	 */
	currentLocation(){
		var location = this.manager.currentLocation();
		if (location && location.then && typeof location.then === "function") {
			location.then(function(result) {
				var percentage = this.book.locations.percentageFromCfi(result);
				if (percentage != null) {
					result.percentage = percentage;
				}
				return result;
			}.bind(this));
		} else if (location) {
			var percentage = this.book.locations.percentageFromCfi(location);
			if (percentage != null) {
				location.percentage = percentage;
			}
			return location;
		}
	}

	/**
	 * Remove and Clean Up the Rendition
	 */
	destroy(){
		// Clear the queue
		this.q.clear();

		this.manager.destroy();
	}

	/**
	 * Pass the events from a view
	 * @private
	 * @param  {View} view
	 */
	passEvents(contents){
		var listenedEvents = Contents.listenedEvents;

		listenedEvents.forEach(function(e){
			contents.on(e, this.triggerViewEvent.bind(this));
		}.bind(this));

		contents.on("selected", this.triggerSelectedEvent.bind(this));
	}

	/**
	 * Emit events passed by a view
	 * @private
	 * @param  {event} e
	 */
	triggerViewEvent(e){
		this.emit(e.type, e);
	}

	/**
	 * Emit a selection event's CFI Range passed from a a view
	 * @private
	 * @param  {EpubCFI} cfirange
	 */
	triggerSelectedEvent(cfirange){
		this.emit("selected", cfirange);
	}

	/**
	 * Get a Range from a Visible CFI
	 * @param  {string} cfi EpubCfi String
	 * @param  {string} ignoreClass
	 * @return {range}
	 */
	range(cfi, ignoreClass){
		var _cfi = new EpubCFI(cfi);
		var found = this.visible().filter(function (view) {
			if(_cfi.spinePos === view.index) return true;
		});

		// Should only every return 1 item
		if (found.length) {
			return found[0].range(_cfi, ignoreClass);
		}
	}

	/**
	 * Hook to adjust images to fit in columns
	 * @param  {View} view
	 */
	adjustImages(contents) {

		if (this._layout.name === "pre-paginated") {
			return new Promise(function(resolve){
				resolve();
			});
		}

		contents.addStylesheetRules([
			["img",
				["max-width", (this._layout.columnWidth) + "px"],
				["max-height", (this._layout.height) + "px"]
			]
		]);
		return new Promise(function(resolve, reject){
			// Wait to apply
			setTimeout(function() {
				resolve();
			}, 1);
		});
	}

	getContents () {
		return this.manager ? this.manager.getContents() : [];
	}

	handleLinks(contents) {
		contents.on("link", (href) => {
			let relative = this.book.path.relative(href);
			this.display(relative);
		});
	}
}

//-- Enable binding events to Renderer
EventEmitter(Rendition.prototype);

export default Rendition;
