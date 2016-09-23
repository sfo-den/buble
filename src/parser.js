var URI = require('urijs');
var core = require('./core');
var EpubCFI = require('./epubcfi');


function Parser(){};

Parser.prototype.container = function(containerXml){
    //-- <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
    var rootfile, fullpath, folder, encoding;

    if(!containerXml) {
      console.error("Container File Not Found");
      return;
    }

    rootfile = core.qs(containerXml, "rootfile");

    if(!rootfile) {
      console.error("No RootFile Found");
      return;
    }

    fullpath = rootfile.getAttribute('full-path');
    folder = URI(fullpath).directory();
    encoding = containerXml.xmlEncoding;

    //-- Now that we have the path we can parse the contents
    return {
      'packagePath' : fullpath,
      'basePath' : folder,
      'encoding' : encoding
    };
};

Parser.prototype.identifier = function(packageXml){
  var metadataNode;

  if(!packageXml) {
    console.error("Package File Not Found");
    return;
  }

  metadataNode = core.qs(packageXml, "metadata");

  if(!metadataNode) {
    console.error("No Metadata Found");
    return;
  }

  return this.getElementText(metadataNode, "identifier");
};

Parser.prototype.packageContents = function(packageXml){
  var parse = this;
  var metadataNode, manifestNode, spineNode;
  var manifest, navPath, ncxPath, coverPath;
  var spineNodeIndex;
  var spine;
  var spineIndexByURL;
  var metadata;

  if(!packageXml) {
    console.error("Package File Not Found");
    return;
  }

  metadataNode = core.qs(packageXml, "metadata");
  if(!metadataNode) {
    console.error("No Metadata Found");
    return;
  }

  manifestNode = core.qs(packageXml, "manifest");
  if(!manifestNode) {
    console.error("No Manifest Found");
    return;
  }

  spineNode = core.qs(packageXml, "spine");
  if(!spineNode) {
    console.error("No Spine Found");
    return;
  }

  manifest = parse.manifest(manifestNode);
  navPath = parse.findNavPath(manifestNode);
  ncxPath = parse.findNcxPath(manifestNode, spineNode);
  coverPath = parse.findCoverPath(packageXml);

  spineNodeIndex = Array.prototype.indexOf.call(spineNode.parentNode.childNodes, spineNode);

  spine = parse.spine(spineNode, manifest);

  metadata = parse.metadata(metadataNode);

	metadata.direction = spineNode.getAttribute("page-progression-direction");

  return {
    'metadata' : metadata,
    'spine'    : spine,
    'manifest' : manifest,
    'navPath'  : navPath,
    'ncxPath'  : ncxPath,
    'coverPath': coverPath,
    'spineNodeIndex' : spineNodeIndex
  };
};

//-- Find TOC NAV
Parser.prototype.findNavPath = function(manifestNode){
	// Find item with property 'nav'
	// Should catch nav irregardless of order
  // var node = manifestNode.querySelector("item[properties$='nav'], item[properties^='nav '], item[properties*=' nav ']");
  var node = core.qsp(manifestNode, "item", {"properties":"nav"});
  return node ? node.getAttribute('href') : false;
};

//-- Find TOC NCX: media-type="application/x-dtbncx+xml" href="toc.ncx"
Parser.prototype.findNcxPath = function(manifestNode, spineNode){
	// var node = manifestNode.querySelector("item[media-type='application/x-dtbncx+xml']");
  var node = core.qsp(manifestNode, "item", {"media-type":"application/x-dtbncx+xml"});
	var tocId;

	// If we can't find the toc by media-type then try to look for id of the item in the spine attributes as
	// according to http://www.idpf.org/epub/20/spec/OPF_2.0.1_draft.htm#Section2.4.1.2,
	// "The item that describes the NCX must be referenced by the spine toc attribute."
	if (!node) {
		tocId = spineNode.getAttribute("toc");
		if(tocId) {
			// node = manifestNode.querySelector("item[id='" + tocId + "']");
      node = manifestNode.getElementById(tocId);
		}
	}

	return node ? node.getAttribute('href') : false;
};

//-- Expanded to match Readium web components
Parser.prototype.metadata = function(xml){
  var metadata = {},
      p = this;

  metadata.title = p.getElementText(xml, 'title');
  metadata.creator = p.getElementText(xml, 'creator');
  metadata.description = p.getElementText(xml, 'description');

  metadata.pubdate = p.getElementText(xml, 'date');

  metadata.publisher = p.getElementText(xml, 'publisher');

  metadata.identifier = p.getElementText(xml, "identifier");
  metadata.language = p.getElementText(xml, "language");
  metadata.rights = p.getElementText(xml, "rights");

  metadata.modified_date = p.getPropertyText(xml, 'dcterms:modified');

  metadata.layout = p.getPropertyText(xml, "rendition:layout");
  metadata.orientation = p.getPropertyText(xml, 'rendition:orientation');
  metadata.flow = p.getPropertyText(xml, 'rendition:flow');
  metadata.viewport = p.getPropertyText(xml, 'rendition:viewport');
  // metadata.page_prog_dir = packageXml.querySelector("spine").getAttribute("page-progression-direction");

  return metadata;
};

//-- Find Cover: <item properties="cover-image" id="ci" href="cover.svg" media-type="image/svg+xml" />
//-- Fallback for Epub 2.0
Parser.prototype.findCoverPath = function(packageXml){
  var pkg = core.qs(packageXml, "package");
	var epubVersion = pkg.getAttribute('version');

	if (epubVersion === '2.0') {
		var metaCover = core.qsp(packageXml, 'meta', {'name':'cover'});
		if (metaCover) {
			var coverId = metaCover.getAttribute('content');
			// var cover = packageXml.querySelector("item[id='" + coverId + "']");
      var cover = packageXml.getElementById(coverId);
			return cover ? cover.getAttribute('href') : false;
		}
		else {
			return false;
		}
	}
	else {
    // var node = packageXml.querySelector("item[properties='cover-image']");
    var node = core.qsp(packageXml, 'item', {'properties':'cover-image'});
		return node ? node.getAttribute('href') : false;
	}
};

Parser.prototype.getElementText = function(xml, tag){
  var found = xml.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", tag),
    el;

  if(!found || found.length === 0) return '';

  el = found[0];

  if(el.childNodes.length){
    return el.childNodes[0].nodeValue;
  }

  return '';

};

Parser.prototype.getPropertyText = function(xml, property){
  var el = core.qsp(xml, "meta", {"property":property});

  if(el && el.childNodes.length){
    return el.childNodes[0].nodeValue;
  }

  return '';
};

Parser.prototype.querySelectorText = function(xml, q){
  var el = xml.querySelector(q);

  if(el && el.childNodes.length){
    return el.childNodes[0].nodeValue;
  }

  return '';
};

Parser.prototype.manifest = function(manifestXml){
  var manifest = {};

  //-- Turn items into an array
  // var selected = manifestXml.querySelectorAll("item");
  var selected = core.qsa(manifestXml, "item");
  var items = Array.prototype.slice.call(selected);

  //-- Create an object with the id as key
  items.forEach(function(item){
    var id = item.getAttribute('id'),
        href = item.getAttribute('href') || '',
        type = item.getAttribute('media-type') || '',
        properties = item.getAttribute('properties') || '';

    manifest[id] = {
      'href' : href,
      // 'url' : href,
      'type' : type,
      'properties' : properties.length ? properties.split(' ') : []
    };

  });

  return manifest;

};

Parser.prototype.spine = function(spineXml, manifest){
  var spine = [];

  var selected = spineXml.getElementsByTagName("itemref"),
      items = Array.prototype.slice.call(selected);

  var epubcfi = new EpubCFI();

  //-- Add to array to mantain ordering and cross reference with manifest
  items.forEach(function(item, index){
    var idref = item.getAttribute('idref');
    // var cfiBase = epubcfi.generateChapterComponent(spineNodeIndex, index, Id);
    var props = item.getAttribute('properties') || '';
    var propArray = props.length ? props.split(' ') : [];
    // var manifestProps = manifest[Id].properties;
    // var manifestPropArray = manifestProps.length ? manifestProps.split(' ') : [];

    var itemref = {
      'idref' : idref,
      'linear' : item.getAttribute('linear') || '',
      'properties' : propArray,
      // 'href' : manifest[Id].href,
      // 'url' :  manifest[Id].url,
      'index' : index
      // 'cfiBase' : cfiBase
    };
    spine.push(itemref);
  });

  return spine;
};

Parser.prototype.querySelectorByType = function(html, element, type){
  var query;
  if (typeof html.querySelector != "undefined") {
    query = html.querySelector(element+'[*|type="'+type+'"]');
  }
	// Handle IE not supporting namespaced epub:type in querySelector
	if(!query || query.length === 0) {
		query = core.qsa(html, element);
		for (var i = 0; i < query.length; i++) {
			if(query[i].getAttributeNS("http://www.idpf.org/2007/ops", "type") === type) {
				return query[i];
			}
		}
	} else {
		return query;
	}
};

Parser.prototype.nav = function(navHtml, spineIndexByURL, bookSpine){
	var navElement = this.querySelectorByType(navHtml, "nav", "toc");
  // var navItems = navElement ? navElement.querySelectorAll("ol li") : [];
	var navItems = navElement ? core.qsa(navElement, "li") : [];
	var length = navItems.length;
	var i;
	var toc = {};
	var list = [];
	var item, parent;

	if(!navItems || length === 0) return list;

	for (i = 0; i < length; ++i) {
		item = this.navItem(navItems[i], spineIndexByURL, bookSpine);
		toc[item.id] = item;
		if(!item.parent) {
			list.push(item);
		} else {
			parent = toc[item.parent];
			parent.subitems.push(item);
		}
	}

	return list;
};

Parser.prototype.navItem = function(item, spineIndexByURL, bookSpine){
	var id = item.getAttribute('id') || false,
			// content = item.querySelector("a, span"),
      content = core.qs(item, "a"),
			src = content.getAttribute('href') || '',
			text = content.textContent || "",
			// split = src.split("#"),
			// baseUrl = split[0],
			// spinePos = spineIndexByURL[baseUrl],
			// spineItem = bookSpine[spinePos],
			subitems = [],
			parentNode = item.parentNode,
			parent;
			// cfi = spineItem ? spineItem.cfi : '';

	if(parentNode && parentNode.nodeName === "navPoint") {
		parent = parentNode.getAttribute('id');
	}

  /*
	if(!id) {
		if(spinePos) {
			spineItem = bookSpine[spinePos];
			id = spineItem.id;
			cfi = spineItem.cfi;
		} else {
			id = 'epubjs-autogen-toc-id-' + EPUBJS.core.uuid();
			item.setAttribute('id', id);
		}
	}
  */

	return {
		"id": id,
		"href": src,
		"label": text,
		"subitems" : subitems,
		"parent" : parent
	};
};

Parser.prototype.ncx = function(tocXml, spineIndexByURL, bookSpine){
	// var navPoints = tocXml.querySelectorAll("navMap navPoint");
  var navPoints = core.qsa(tocXml, "navPoint");
	var length = navPoints.length;
	var i;
	var toc = {};
	var list = [];
	var item, parent;

	if(!navPoints || length === 0) return list;

	for (i = 0; i < length; ++i) {
		item = this.ncxItem(navPoints[i], spineIndexByURL, bookSpine);
		toc[item.id] = item;
		if(!item.parent) {
			list.push(item);
		} else {
			parent = toc[item.parent];
			parent.subitems.push(item);
		}
	}

	return list;
};

Parser.prototype.ncxItem = function(item, spineIndexByURL, bookSpine){
	var id = item.getAttribute('id') || false,
			// content = item.querySelector("content"),
			content = core.qs(item, "content"),
			src = content.getAttribute('src'),
      // navLabel = item.querySelector("navLabel"),
      navLabel = core.qs(item, "navLabel"),
			text = navLabel.textContent ? navLabel.textContent : "",
			// split = src.split("#"),
			// baseUrl = split[0],
			// spinePos = spineIndexByURL[baseUrl],
			// spineItem = bookSpine[spinePos],
			subitems = [],
			parentNode = item.parentNode,
			parent;
			// cfi = spineItem ? spineItem.cfi : '';

	if(parentNode && parentNode.nodeName === "navPoint") {
		parent = parentNode.getAttribute('id');
	}

  /*
	if(!id) {
		if(spinePos) {
			spineItem = bookSpine[spinePos];
			id = spineItem.id;
			cfi = spineItem.cfi;
		} else {
			id = 'epubjs-autogen-toc-id-' + EPUBJS.core.uuid();
			item.setAttribute('id', id);
		}
	}
  */

	return {
		"id": id,
		"href": src,
		"label": text,
		"subitems" : subitems,
		"parent" : parent
	};
};

Parser.prototype.pageList = function(navHtml, spineIndexByURL, bookSpine){
	var navElement = this.querySelectorByType(navHtml, "nav", "page-list");
  // var navItems = navElement ? navElement.querySelectorAll("ol li") : [];
	var navItems = navElement ? core.qsa(navElement, "li") : [];
	var length = navItems.length;
	var i;
	var toc = {};
	var list = [];
	var item;

	if(!navItems || length === 0) return list;

	for (i = 0; i < length; ++i) {
		item = this.pageListItem(navItems[i], spineIndexByURL, bookSpine);
		list.push(item);
	}

	return list;
};

Parser.prototype.pageListItem = function(item, spineIndexByURL, bookSpine){
	var id = item.getAttribute('id') || false,
		// content = item.querySelector("a"),
    content = core.qs(item, "a"),
		href = content.getAttribute('href') || '',
		text = content.textContent || "",
		page = parseInt(text),
		isCfi = href.indexOf("epubcfi"),
		split,
		packageUrl,
		cfi;

	if(isCfi != -1) {
		split = href.split("#");
		packageUrl = split[0];
		cfi = split.length > 1 ? split[1] : false;
		return {
			"cfi" : cfi,
			"href" : href,
			"packageUrl" : packageUrl,
			"page" : page
		};
	} else {
		return {
			"href" : href,
			"page" : page
		};
	}
};

module.exports = Parser;
