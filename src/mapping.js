import EpubCFI from "./epubcfi";

class Mapping {
	constructor(layout) {
		this.layout = layout;
	}

	section(view) {
		var ranges = this.findRanges(view);
		var map = this.rangeListToCfiList(view.section.cfiBase, ranges);

		return map;
	}

	page(contents, cfiBase, start, end) {
		var root = contents && contents.document ? contents.document.body : false;

		if (!root) {
			return;
		}

		return this.rangePairToCfiPair(cfiBase, {
			start: this.findStart(root, start, end),
			end: this.findEnd(root, start, end)
		});
	}

	walk(root, func) {
		//var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT, null, false);
		var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: function (node) {
				if ( node.data.trim().length > 0 ) {
					return NodeFilter.FILTER_ACCEPT;
				} else {
					return NodeFilter.FILTER_REJECT;
				}
			}
		}, false);
		var node;
		var result;
		while ((node = treeWalker.nextNode())) {
			result = func(node);
			if(result) break;
		}

		return result;
	}

	findRanges(view){
		var columns = [];
		var scrollWidth = view.contents.scrollWidth();
		var count = this.layout.count(scrollWidth);
		var column = this.layout.column;
		var gap = this.layout.gap;
		var start, end;

		for (var i = 0; i < count.pages; i++) {
			start = (column + gap) * i;
			end = (column * (i+1)) + (gap * i);
			columns.push({
				start: this.findStart(view.document.body, start, end),
				end: this.findEnd(view.document.body, start, end)
			});
		}

		return columns;
	}

	findStart(root, start, end){
		var stack = [root];
		var $el;
		var found;
		var $prev = root;
		while (stack.length) {

			$el = stack.shift();

			found = this.walk($el, function(node){
				var left, right;
				var elPos;
				var elRange;


				if(node.nodeType == Node.TEXT_NODE){
					elRange = document.createRange();
					elRange.selectNodeContents(node);
					elPos = elRange.getBoundingClientRect();
				} else {
					elPos = node.getBoundingClientRect();
				}

				left = elPos.left;
				right = elPos.right;

				if( left >= start && left <= end ) {
					return node;
				} else if (right > start) {
					return node;
				} else {
					$prev = node;
					stack.push(node);
				}

			});

			if(found) {
				return this.findTextStartRange(found, start, end);
			}

		}

		// Return last element
		return this.findTextStartRange($prev, start, end);
	}

	findEnd(root, start, end){
		var stack = [root];
		var $el;
		var $prev = root;
		var found;

		while (stack.length) {

			$el = stack.shift();

			found = this.walk($el, function(node){

				var left, right;
				var elPos;
				var elRange;


				if(node.nodeType == Node.TEXT_NODE){
					elRange = document.createRange();
					elRange.selectNodeContents(node);
					elPos = elRange.getBoundingClientRect();
				} else {
					elPos = node.getBoundingClientRect();
				}

				left = elPos.left;
				right = elPos.right;

				if(left > end && $prev) {
					return $prev;
				} else if(right > end) {
					return node;
				} else {
					$prev = node;
					stack.push(node);
				}

			});


			if(found){
				return this.findTextEndRange(found, start, end);
			}

		}

		// end of chapter
		return this.findTextEndRange($prev, start, end);
	}


	findTextStartRange(node, start, end){
		var ranges = this.splitTextNodeIntoRanges(node);
		var range;
		var pos;

		for (var i = 0; i < ranges.length; i++) {
			range = ranges[i];

			pos = range.getBoundingClientRect();

			if( pos.left >= start ) {
				return range;
			}

			// prev = range;

		}

		return ranges[0];
	}

	findTextEndRange(node, start, end){
		var ranges = this.splitTextNodeIntoRanges(node);
		var prev;
		var range;
		var pos;

		for (var i = 0; i < ranges.length; i++) {
			range = ranges[i];

			pos = range.getBoundingClientRect();

			if(pos.left > end && prev) {
				return prev;
			} else if(pos.right > end) {
				return range;
			}

			prev = range;

		}

		// Ends before limit
		return ranges[ranges.length-1];

	}

	splitTextNodeIntoRanges(node, _splitter){
		var ranges = [];
		var textContent = node.textContent || "";
		var text = textContent.trim();
		var range;
		var doc = node.ownerDocument;
		var splitter = _splitter || " ";

		var pos = text.indexOf(splitter);

		if(pos === -1 || node.nodeType != Node.TEXT_NODE) {
			range = doc.createRange();
			range.selectNodeContents(node);
			return [range];
		}

		range = doc.createRange();
		range.setStart(node, 0);
		range.setEnd(node, pos);
		ranges.push(range);
		range = false;

		while ( pos != -1 ) {

			pos = text.indexOf(splitter, pos + 1);
			if(pos > 0) {

				if(range) {
					range.setEnd(node, pos);
					ranges.push(range);
				}

				range = doc.createRange();
				range.setStart(node, pos+1);
			}
		}

		if(range) {
			range.setEnd(node, text.length);
			ranges.push(range);
		}

		return ranges;
	}



	rangePairToCfiPair(cfiBase, rangePair){

		var startRange = rangePair.start;
		var endRange = rangePair.end;

		startRange.collapse(true);
		endRange.collapse(true);

		// startCfi = section.cfiFromRange(startRange);
		// endCfi = section.cfiFromRange(endRange);
		let startCfi = new EpubCFI(startRange, cfiBase).toString();
		let endCfi = new EpubCFI(endRange, cfiBase).toString();

		return {
			start: startCfi,
			end: endCfi
		};

	}

	rangeListToCfiList(cfiBase, columns){
		var map = [];
		var cifPair;

		for (var i = 0; i < columns.length; i++) {
			cifPair = this.rangePairToCfiPair(cfiBase, columns[i]);

			map.push(cifPair);

		}

		return map;
	}
}

export default Mapping;
