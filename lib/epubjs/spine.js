EPUBJS.Spine = function(_request){
  this.request = _request;
  this.spineItems = [];
  this.spineByHref = {};
  this.spineById = {};

};

EPUBJS.Spine.prototype.load = function(_package) {

  this.items = _package.spine;
  this.manifest = _package.manifest;
  this.spineNodeIndex = _package.spineNodeIndex;
  this.baseUrl = _package.baseUrl || '';
  this.length = this.items.length;
  this.epubcfi = new EPUBJS.EpubCFI();

  this.items.forEach(function(item, index){
    var href, url;
    var manifestItem = this.manifest[item.idref];
    var spineItem;
    item.cfiBase = this.epubcfi.generateChapterComponent(this.spineNodeIndex, item.index, item.idref);

    if(manifestItem) {
      item.href = manifestItem.href;
      item.url = this.baseUrl + item.href;
    }

    spineItem = new EPUBJS.Section(item);
    this.append(spineItem);


  }.bind(this));

};

// book.spine.get();
// book.spine.get(1);
// book.spine.get("chap1.html");
// book.spine.get("#id1234");
EPUBJS.Spine.prototype.get = function(target) {
  var index = 0;

  if(target && (typeof target === "number" || isNaN(target) === false)){
    index = target;
  } else if(target && target.indexOf("#") === 0) {
    index = this.spineById[target.substring(1)];
  } else if(target) {
    index = this.spineByHref[target];
  }

  return this.spineItems[index];
};

EPUBJS.Spine.prototype.append = function(section) {
  var index = this.spineItems.length;
  section.index = index;

  this.spineItems.push(section);

  this.spineByHref[section.href] = index;
  this.spineById[section.idref] = index;

  return index;
};

EPUBJS.Spine.prototype.prepend = function(section) {
  var index = this.spineItems.unshift(section);
  this.spineByHref[section.href] = 0;
  this.spineById[section.idref] = 0;

  // Re-index
  this.spineItems.forEach(function(item, index){
    item.index = index;
  });

  return 0;
};

EPUBJS.Spine.prototype.insert = function(section, index) {

};

EPUBJS.Spine.prototype.remove = function(section) {
  var index = this.spineItems.indexOf(section);

  if(index > -1) {
    delete this.spineByHref[section.href];
    delete this.spineById[section.idref];

    return this.spineItems.splice(index, 1);
  }
};