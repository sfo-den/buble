module('Rendering');

asyncTest("Render To", 1, function() {

  var book = ePub("../books/moby-dick/OPS/package.opf");
  var rendition = book.renderTo("qunit-fixture");
  var displayed = rendition.display();

  displayed.then(function(){
    equal( $( "iframe", "#qunit-fixture" ).length, 1, "iframe added successfully" );
    start();
  });


});