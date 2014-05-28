EPUBJS.Parser = function(baseUrl){
	this.baseUrl = baseUrl || '';
};

EPUBJS.Parser.prototype.container = function(containerXml){
		//-- <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
		var rootfile, fullpath, folder, encoding;
		
		if(!containerXml) {
			console.error("Container File Not Found");
			return;
		}
		
		rootfile = containerXml.querySelector("rootfile");
		
		if(!rootfile) {
			console.error("No RootFile Found");
			return;
		}
		
		fullpath = rootfile.getAttribute('full-path');
		folder = EPUBJS.core.uri(fullpath).directory;
		encoding = containerXml.xmlEncoding;

		//-- Now that we have the path we can parse the contents
		return {
			'packagePath' : fullpath,
			'basePath' : folder,
			'encoding' : encoding
		};
};

EPUBJS.Parser.prototype.identifier = function(packageXml){
	var metadataNode;
	
	if(!packageXml) {
		console.error("Package File Not Found");
		return;
	}
	
	metadataNode = packageXml.querySelector("metadata");
	
	if(!metadataNode) {
		console.error("No Metadata Found");
		return;
	}
	
	return this.getElementText(metadataNode, "identifier");
};

EPUBJS.Parser.prototype.packageContents = function(packageXml, baseUrl){
	var parse = this;
	var metadataNode, manifestNode, spineNode;
	var manifest, navPath, tocPath, coverPath;
	var spineNodeIndex;
	var spine;
	var spineIndexByURL;
	
	if(baseUrl) this.baseUrl = baseUrl;
	
	if(!packageXml) {
		console.error("Package File Not Found");
		return;
	}
	
	metadataNode = packageXml.querySelector("metadata");
	if(!metadataNode) {
		console.error("No Metadata Found");
		return;
	}
	
	manifestNode = packageXml.querySelector("manifest");
	if(!manifestNode) {
		console.error("No Manifest Found");
		return;
	}
	
	spineNode = packageXml.querySelector("spine");
	if(!spineNode) {
		console.error("No Spine Found");
		return;
	}
	
	manifest = parse.manifest(manifestNode);
	navPath = parse.findNavPath(manifestNode);
	tocPath = parse.findTocPath(manifestNode);
	coverPath = parse.findCoverPath(manifestNode);

	spineNodeIndex = Array.prototype.indexOf.call(spineNode.parentNode.childNodes, spineNode);
	
	spine = parse.spine(spineNode, manifest);
	
	spineIndexByURL = {};
	spine.forEach(function(item){
		spineIndexByURL[item.href] = item.index;
	});

	return {
		'metadata' : parse.metadata(metadataNode),
		'spine'    : spine,
		'manifest' : manifest,
		'navPath'  : navPath,
		'tocPath'  : tocPath,
		'coverPath': coverPath,
		'spineNodeIndex' : spineNodeIndex,
		'spineIndexByURL' : spineIndexByURL
	};
};

//-- Find TOC NAV: media-type="application/xhtml+xml" href="toc.ncx"
EPUBJS.Parser.prototype.findNavPath = function(manifestNode){
  var node = manifestNode.querySelector("item[properties^='nav']");
  return node ? node.getAttribute('href') : false;
};

//-- Find TOC NCX: media-type="application/x-dtbncx+xml" href="toc.ncx"
EPUBJS.Parser.prototype.findTocPath = function(manifestNode){
	var node = manifestNode.querySelector("item[media-type='application/x-dtbncx+xml']");
	return node ? node.getAttribute('href') : false;
};

//-- Find Cover: <item properties="cover-image" id="ci" href="cover.svg" media-type="image/svg+xml" />
EPUBJS.Parser.prototype.findCoverPath = function(manifestNode){
	var node = manifestNode.querySelector("item[properties='cover-image']");
	return node ? node.getAttribute('href') : false;
};

//-- Expanded to match Readium web components
EPUBJS.Parser.prototype.metadata = function(xml){
	var metadata = {},
			p = this;
	
	metadata.bookTitle = p.getElementText(xml, 'title');
	metadata.creator = p.getElementText(xml, 'creator');
	metadata.description = p.getElementText(xml, 'description');
	
	metadata.pubdate = p.getElementText(xml, 'date');
	
	metadata.publisher = p.getElementText(xml, 'publisher');
	
	metadata.identifier = p.getElementText(xml, "identifier");
	metadata.language = p.getElementText(xml, "language");
	metadata.rights = p.getElementText(xml, "rights");
	
	metadata.modified_date = p.querySelectorText(xml, "meta[property='dcterms:modified']");
	metadata.layout = p.querySelectorText(xml, "meta[property='rendition:layout']");
	metadata.orientation = p.querySelectorText(xml, "meta[property='rendition:orientation']");
	metadata.spread = p.querySelectorText(xml, "meta[property='rendition:spread']");
	// metadata.page_prog_dir = packageXml.querySelector("spine").getAttribute("page-progression-direction");
	
	return metadata;
};

EPUBJS.Parser.prototype.getElementText = function(xml, tag){
	var found = xml.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", tag),
		el;

	if(!found || found.length === 0) return '';
	
	el = found[0];

	if(el.childNodes.length){
		return el.childNodes[0].nodeValue;
	}

	return '';
	
};

EPUBJS.Parser.prototype.querySelectorText = function(xml, q){
	var el = xml.querySelector(q);

	if(el && el.childNodes.length){
		return el.childNodes[0].nodeValue;
	}

	return '';
};

EPUBJS.Parser.prototype.manifest = function(manifestXml){
	var baseUrl = this.baseUrl,
			manifest = {};
	
	//-- Turn items into an array
	var selected = manifestXml.querySelectorAll("item"),
		items = Array.prototype.slice.call(selected);
		
	//-- Create an object with the id as key
	items.forEach(function(item){
		var id = item.getAttribute('id'),
				href = item.getAttribute('href') || '',
				type = item.getAttribute('media-type') || '',
				properties = item.getAttribute('properties') || '';
		
		manifest[id] = {
			'href' : href,
			'url' : baseUrl + href, //-- Absolute URL for loading with a web worker
			'type' : type,
      'properties' : properties
		};
	
	});
	
	return manifest;

};

EPUBJS.Parser.prototype.spine = function(spineXml, manifest){
	var spine = [];
	
	var selected = spineXml.getElementsByTagName("itemref"),
			items = Array.prototype.slice.call(selected);

	var spineNodeIndex = Array.prototype.indexOf.call(spineXml.parentNode.childNodes, spineXml);

	var epubcfi = new EPUBJS.EpubCFI();

	//-- Add to array to mantain ordering and cross reference with manifest
	items.forEach(function(item, index){
		var Id = item.getAttribute('idref');
		var cfiBase = epubcfi.generateChapterComponent(spineNodeIndex, index, Id);
		var props = item.getAttribute('properties') || '';
		var propArray = props.length ? props.split(' ') : [];
		var manifestProps = manifest[Id].properties;
		var manifestPropArray = manifestProps.length ? manifestProps.split(' ') : [];
		var vert = {
			'id' : Id,
			'linear' : item.getAttribute('linear') || '',
			'properties' : propArray,
			'manifestProperties' : manifestPropArray,
			'href' : manifest[Id].href,
			'url' :  manifest[Id].url,
			'index' : index,
			'cfiBase' : cfiBase,
			'cfi' : "epub(" + cfiBase + ")"
		};
		spine.push(vert);
	});
	
	return spine;
};

EPUBJS.Parser.prototype.nav = function(navHtml, spineIndexByURL, bookSpine){
	var navEl = navHtml.querySelector('nav[*|type="toc"]'), //-- [*|type="toc"] * Doesn't seem to work
			idCounter = 0;
	
	if(!navEl) return [];
	
	// Implements `> ol > li`
	function findListItems(parent){
		var items = [];
	
		Array.prototype.slice.call(parent.childNodes).forEach(function(node){
			if('ol' == node.tagName){
				Array.prototype.slice.call(node.childNodes).forEach(function(item){
					if('li' == item.tagName){
						items.push(item);
					}
				});
			}
		});
		
		return items;
	
	}
	
	// Implements `> a, > span`
	function findAnchorOrSpan(parent){
		var item = null;
		
		Array.prototype.slice.call(parent.childNodes).forEach(function(node){
			if('a' == node.tagName || 'span' == node.tagName){
				item = node;
			}
		});
		
		return item;
	}
	
	function getTOC(parent){
		var list = [],
				nodes = findListItems(parent),
				items = Array.prototype.slice.call(nodes),
				length = items.length,
				node;
	
		if(length === 0) return false;
		
		items.forEach(function(item){
			var id = item.getAttribute('id') || false,
				content = findAnchorOrSpan(item),
				href = content.getAttribute('href') || '',
				text = content.textContent || "",
				split = href.split("#"),
				baseUrl = split[0],
				subitems = getTOC(item),
				spinePos = spineIndexByURL[baseUrl],
				spineItem = bookSpine[spinePos],
				cfi = 	spineItem ? spineItem.cfi : '';
				
			if(!id) {
				if(spinePos) {
					spineItem = bookSpine[spinePos];
					id = spineItem.id;
					cfi = spineItem.cfi;
				} else {
					id = 'epubjs-autogen-toc-id-' + (idCounter++);
				}
			}
			
			item.setAttribute('id', id); // Ensure all elements have an id
			list.push({
				"id": id,
				"href": href,
				"label": text,
				"subitems" : subitems,
				"parent" : parent ? parent.getAttribute('id') : null,
				"cfi" : cfi
			});
		
		});
	
		return list;
	}
	
	return getTOC(navEl);
};

EPUBJS.Parser.prototype.toc = function(tocXml, spineIndexByURL, bookSpine){
	var navMap = tocXml.querySelector("navMap");
	if(!navMap) return [];
	
	function getTOC(parent){
		var list = [],
				nodes = parent.querySelectorAll("navPoint"),
				items = Array.prototype.slice.call(nodes).reverse(),
				length = items.length,
				iter = length,
				node;
		
		if(length === 0) return [];

		items.forEach(function(item){
			var id = item.getAttribute('id') || false,
					content = item.querySelector("content"),
					src = content.getAttribute('src'),
					navLabel = item.querySelector("navLabel"),
					text = navLabel.textContent ? navLabel.textContent : "",
					split = src.split("#"),
					baseUrl = split[0],
					spinePos = spineIndexByURL[baseUrl],
					spineItem = bookSpine[spinePos],
					subitems = getTOC(item),
					cfi = 	spineItem ? spineItem.cfi : '';

			if(!id) {
				if(spinePos) {
					spineItem = bookSpine[spinePos];
					id = spineItem.id;
					cfi = 	spineItem.cfi;
				} else {
					id = 'epubjs-autogen-toc-id-' + (idCounter++);
				}
			}
			
			
			list.unshift({
						"id": id,
						"href": src,
						"label": text,
						"spinePos": spinePos,
						"subitems" : subitems,
						"parent" : parent ? parent.getAttribute('id') : null,
						"cfi" : cfi
			});

		});

		return list;
	}

	return getTOC(navMap);
};

EPUBJS.Parser.prototype.pageList = function(navHtml, spineIndexByURL, bookSpine){
	var navEl = navHtml.querySelector('nav[*|type="page-list"]'),
			idCounter = 0;

	if(!navEl) return [];
	
	// Implements `> ol > li`
	function findListItems(parent){
		var items = [];
	
		Array.prototype.slice.call(parent.childNodes).forEach(function(node){
			if('ol' == node.tagName){
				Array.prototype.slice.call(node.childNodes).forEach(function(item){
					if('li' == item.tagName){
						items.push(item);
					}
				});
			}
		});
		
		return items;
	
	}
	
	// Implements `> a, > span`
	function findAnchorOrSpan(parent){
		var item = null;
		
		Array.prototype.slice.call(parent.childNodes).forEach(function(node){
			if('a' == node.tagName || 'span' == node.tagName){
				item = node;
			}
		});
		
		return item;
	}
	
	function getPages(parent){
		var list = [],
				nodes = findListItems(parent),
				items = Array.prototype.slice.call(nodes),
				length = items.length,
				node;
	
		if(length === 0) return false;
		
		items.forEach(function(item){
			var id = item.getAttribute('id') || false,
				content = findAnchorOrSpan(item),
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
				list.push({
					"cfi" : cfi,
					"href" : href,
					"packageUrl" : packageUrl,
					"page" : page
				});
			} else {
				list.push({
					"href" : href,
					"page" : page
				});
			}

		});
	
		return list;
	}
	
	return getPages(navEl);
};
