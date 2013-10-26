EPUBJS.Parser = function(baseUrl){
	this.baseUrl = baseUrl || '';
}

EPUBJS.Parser.prototype.container = function(containerXml){

		//-- <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
		var rootfile = containerXml.querySelector("rootfile"),
			fullpath = rootfile.getAttribute('full-path'),
			folder = EPUBJS.core.folder(fullpath);
		console.log("rootfile", containerXml.querySelectorAll("rootfile"));
		//-- Now that we have the path we can parse the contents
		return {
			'packagePath' : fullpath,
			'basePath' : folder
		};
}

EPUBJS.Parser.prototype.package = function(packageXml, baseUrl){
	var parse = this;

	if(baseUrl) this.baseUrl = baseUrl;
	
	var metadataNode = packageXml.querySelector("metadata"),
		manifestNode = packageXml.querySelector("manifest"),
		spineNode = packageXml.querySelector("spine");

	var manifest = parse.manifest(manifestNode),
		tocPath = parse.findTocPath(manifestNode),
		coverPath = parse.findCoverPath(manifestNode);

	var spineNodeIndex = Array.prototype.indexOf.call(spineNode.parentNode.childNodes, spineNode);
	
	var spine = parse.spine(spineNode, manifest);
	
	var spineIndexByURL = {};
	spine.forEach(function(item){
		spineIndexByURL[item.href] = item.index;
	});

	return {
		'metadata' : parse.metadata(metadataNode),
		'spine'    : spine,
		'manifest' : manifest,
		'tocPath'  : tocPath,
		'coverPath': coverPath,
		'spineNodeIndex' : spineNodeIndex,
		'spineIndexByURL': spineIndexByURL
	};
}

//-- Find TOC NCX: media-type="application/x-dtbncx+xml" href="toc.ncx"
EPUBJS.Parser.prototype.findTocPath = function(manifestNode){
	var node = manifestNode.querySelector("item[media-type='application/x-dtbncx+xml']");
	return node ? node.getAttribute('href') : false;
}

//-- Find Cover: <item properties="cover-image" id="ci" href="cover.svg" media-type="image/svg+xml" />
EPUBJS.Parser.prototype.findCoverPath = function(manifestNode){
	var node = manifestNode.querySelector("item[properties='cover-image']");
	return node ? node.getAttribute('href') : false;
}


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
	metadata.layout = p.querySelectorText(xml, "meta[property='rendition:orientation']");
	metadata.orientation = p.querySelectorText(xml, "meta[property='rendition:orientation']");
	metadata.spread = p.querySelectorText(xml, "meta[property='rendition:spread']");
	// metadata.page_prog_dir = packageXml.querySelector("spine").getAttribute("page-progression-direction");
	
	return metadata;
}

EPUBJS.Parser.prototype.getElementText = function(xml, tag){
	var found = xml.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", tag),
		el;

	if(!found || found.length == 0) return '';
	
	el = found[0]; 

	if(el.childNodes.length){
		return el.childNodes[0].nodeValue;
	}

	return '';
	
}

EPUBJS.Parser.prototype.querySelectorText = function(xml, q){
	var el = xml.querySelector(q);

	if(el && el.childNodes.length){
		return el.childNodes[0].nodeValue;
	}

	return '';
}


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
			type = item.getAttribute('media-type') || '';
		
		manifest[id] = {
			'href' : baseUrl + href, //-- Absolute URL for loading with a web worker
			'type' : type
		};
	
	});
	
	return manifest;

}

EPUBJS.Parser.prototype.spine = function(spineXml, manifest){
	var spine = [];
	
	var selected = spineXml.getElementsByTagName("itemref"),
		items = Array.prototype.slice.call(selected);
	
	//-- Add to array to mantain ordering and cross reference with manifest
	items.forEach(function(item, index){
		var Id = item.getAttribute('idref');
		
		var vert = {
			'id' : Id,
			'linear' : item.getAttribute('linear') || '',
			'properties' : item.getAttribute('properties') || '',
			'href' : manifest[Id].href,
			'index' : index
		}
		
	
		spine.push(vert);
	});
	
	return spine;
}

EPUBJS.Parser.prototype.toc = function(tocXml){
	
	var navMap = tocXml.querySelector("navMap");

	function getTOC(parent){
		var list = [],
			items = [],
			nodes = parent.childNodes,
			nodesArray = Array.prototype.slice.call(nodes),
			length = nodesArray.length,
			iter = length,
			node;
		

		if(length == 0) return false;

		while(iter--){
			node = nodesArray[iter];
				if(node.nodeName === "navPoint") {
					items.push(node);
				}
		}
		
		items.forEach(function(item){
			var id = item.getAttribute('id'),
				content = item.querySelector("content"),
				src = content.getAttribute('src'),
				split = src.split("#"),
				navLabel = item.querySelector("navLabel"),
				text = navLabel.textContent ? navLabel.textContent : "",
				subitems = getTOC(item);
			list.unshift({
						"id": id, 
						"href": src, 
						"label": text,
						"subitems" : subitems,
						"parent" : parent ? parent.getAttribute('id') : null
			});

		});

		return list;
	}
	
	return getTOC(navMap);


}

