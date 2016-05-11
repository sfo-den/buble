var RSVP = require('rsvp');
var core = require('../core');
var Stage = require('../stage');
var Views = require('../views');
var EpubCFI = require('../epubcfi');
var Layout = require('../layout');
var Mapping = require('../map');

function SingleViewManager(options) {

	this.View = options.view;
	this.request = options.request;
	this.q = options.queue;

	this.settings = core.extend(this.settings || {}, {
		infinite: true,
		hidden: false,
		width: false,
		height: null,
		globalLayoutProperties : { layout: 'reflowable', spread: 'auto', orientation: 'auto'},
		// layout: null,
		axis: "vertical",
		ignoreClass: ''
	});

	core.defaults(this.settings, options.settings || {});

	this.viewSettings = {
		ignoreClass: this.settings.ignoreClass,
		globalLayoutProperties: this.settings.globalLayoutProperties,
		axis: this.settings.axis,
		layout: this.layout,
		width: 0,
		height: 0
	};

}

SingleViewManager.prototype.render = function(element, size){

	// Save the stage
	this.stage = new Stage({
		width: size.width,
		height: size.height,
		overflow: this.settings.overflow,
		hidden: this.settings.hidden,
		axis: this.settings.axis
	});

	this.stage.attachTo(element);

	// Get this stage container div
	this.container = this.stage.getContainer();

	// Views array methods
	this.views = new Views(this.container);

	// Calculate Stage Size
	this._bounds = this.bounds();
	this._stageSize = this.stage.size();

	// Set the dimensions for views
	this.viewSettings.width = this._stageSize.width;
	this.viewSettings.height = this._stageSize.height;

	// Function to handle a resize event.
	// Will only attach if width and height are both fixed.
	this.stage.onResize(this.onResized.bind(this));

	// Add Event Listeners
	this.addEventListeners();

	// Add Layout method
	this.applyLayoutMethod();
};

SingleViewManager.prototype.addEventListeners = function(){

};

SingleViewManager.prototype.onResized = function(e) {
	this.resize();
};

SingleViewManager.prototype.resize = function(width, height){

	this._stageSize = this.stage.size(width, height);
	this._bounds = this.bounds();

	// Update for new views
	this.viewSettings.width = this._stageSize.width;
	this.viewSettings.height = this._stageSize.height;

	// Update for existing views
	this.views.each(function(view) {
		view.size(this._stageSize.width, this._stageSize.height);
	}.bind(this));

	this.trigger("resized", {
		width: this._stageSize.width,
		height: this._stageSize.height
	});

};

SingleViewManager.prototype.setLayout = function(layout){

	this.viewSettings.layout = layout;

	this.views.each(function(view){
		view.setLayout(layout);
	});

};

SingleViewManager.prototype.createView = function(section) {
	return new this.View(section, this.viewSettings);
};

SingleViewManager.prototype.display = function(section, target){

	var displaying = new RSVP.defer();
	var displayed = displaying.promise;

	var isCfi = EpubCFI().isCfiString(target);

	// Check to make sure the section we want isn't already shown
	var visible = this.views.find(section);

	// View is already shown, just move to correct location
	if(visible && target) {
		offset = visible.locationOf(target);
		this.moveTo(offset);
		displaying.resolve();
		return displayed;
	}

	// Hide all current views
	this.views.hide();

	this.views.clear();

	// Create a new view
	view = this.createView(section);

	return this.add(view)
		.then(function(){

			// Move to correct place within the section, if needed
			if(target) {
				offset = view.locationOf(target);
				this.moveTo(offset);
			}

		}.bind(this))
		// .then(function(){
		// 	return this.hooks.display.trigger(view);
		// }.bind(this))
		.then(function(){
			this.views.show();
		}.bind(this));

};

SingleViewManager.prototype.afterDisplayed = function(view){
	this.trigger("added", view);
};

SingleViewManager.prototype.afterResized = function(view){
	this.trigger("resize", view.section);
};

SingleViewManager.prototype.moveTo = function(offset){
	this.scrollTo(offset.left, offset.top);
};

SingleViewManager.prototype.add = function(view){

	this.views.append(view);

	// view.on("shown", this.afterDisplayed.bind(this));
	view.onDisplayed = this.afterDisplayed.bind(this);
	view.onResize = this.afterResized.bind(this);

	return view.display(this.request);
	// return this.renderer(view, this.views.hidden);
};

// SingleViewManager.prototype.resizeView = function(view) {
//
// 	if(this.settings.globalLayoutProperties.layout === "pre-paginated") {
// 		view.lock("both", this.bounds.width, this.bounds.height);
// 	} else {
// 		view.lock("width", this.bounds.width, this.bounds.height);
// 	}
//
// };

SingleViewManager.prototype.next = function(){
	var next;
	var view;

	if(!this.views.length) return;

	next = this.views.last().section.next();

	if(next) {
		this.views.clear();

		view = this.createView(next);
		return this.add(view)
		.then(function(){
			this.views.show();
		}.bind(this));
	}
};

SingleViewManager.prototype.prev = function(){
	var prev;
	var view;

	if(!this.views.length) return;

	prev = this.views.first().section.prev();
	if(prev) {
		this.views.clear();

		view = this.createView(prev);
		return this.add(view)
		.then(function(){
			this.views.show();
		}.bind(this));
	}
};

SingleViewManager.prototype.current = function(){
	var visible = this.visible();
	if(visible.length){
		// Current is the last visible view
		return visible[visible.length-1];
	}
  return null;
};

SingleViewManager.prototype.currentLocation = function(){
  var view;
  var start, end;

  if(this.views.length) {
  	view = this.views.first();
    start = container.left - view.position().left;
    end = start + this.layout.spread;

    return this.mapping.page(view);
  }

};

SingleViewManager.prototype.isVisible = function(view, offsetPrev, offsetNext, _container){
	var position = view.position();
	var container = _container || this.bounds();

	if(this.settings.axis === "horizontal" &&
		position.right > container.left - offsetPrev &&
		position.left < container.right + offsetNext) {

		return true;

  } else if(this.settings.axis === "vertical" &&
  	position.bottom > container.top - offsetPrev &&
		position.top < container.bottom + offsetNext) {

		return true;
  }

	return false;

};

SingleViewManager.prototype.visible = function(){
	return this.views.displayed();
	/*
	var container = this.stage.bounds();
	var views = this.views;
	var viewsLength = views.length;
  var visible = [];
  var isVisible;
  var view;

  for (var i = 0; i < viewsLength; i++) {
    view = views[i];
    isVisible = this.isVisible(view, 0, 0, container);

    if(isVisible === true) {
      visible.push(view);
    }

  }
  return visible;
	*/
};

SingleViewManager.prototype.scrollBy = function(x, y, silent){
  if(silent) {
    this.ignore = true;
  }

  if(this.settings.height) {

    if(x) this.container.scrollLeft += x;
  	if(y) this.container.scrollTop += y;

  } else {
  	window.scrollBy(x,y);
  }
  // console.log("scrollBy", x, y);
  this.scrolled = true;
	this.onScroll();
};

SingleViewManager.prototype.scrollTo = function(x, y, silent){
  if(silent) {
    this.ignore = true;
  }

  if(this.settings.height) {
  	this.container.scrollLeft = x;
  	this.container.scrollTop = y;
  } else {
  	window.scrollTo(x,y);
  }
  // console.log("scrollTo", x, y);
  this.scrolled = true;
	this.onScroll();
  // if(this.container.scrollLeft != x){
  //   setTimeout(function() {
  //     this.scrollTo(x, y, silent);
  //   }.bind(this), 10);
  //   return;
  // };
 };

 SingleViewManager.prototype.onScroll = function(){

};

 SingleViewManager.prototype.bounds = function() {
   var bounds;

   if(!this.settings.height || !this.container) {
     bounds = core.windowBounds();
   } else {
     bounds = this.stage.bounds();
   }

   return bounds;
 };

 SingleViewManager.prototype.applyLayoutMethod = function() {

 	this.layout = new Layout.Scroll();
 	this.calculateLayout();

	this.setLayout(this.layout);

 	this.mapping = new Mapping(this.layout);
 	// this.manager.layout(this.layout.format);
 };

 SingleViewManager.prototype.calculateLayout = function() {
 	var bounds = this.stage.bounds();
 	this.layout.calculate(bounds.width, bounds.height);
 };

 SingleViewManager.prototype.updateLayout = function() {
 	this.calculateLayout();

 	this.setLayout(this.layout);
 };

 //-- Enable binding events to Manager
 RSVP.EventTarget.mixin(SingleViewManager.prototype);

 module.exports = SingleViewManager;
