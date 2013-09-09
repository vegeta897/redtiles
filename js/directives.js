/* Directives and Filters */

angular.module('Redtiles.directives', [])
    .directive('tile', function() {
        return {
            restrict: 'C',
            link: function(scope, element, attrs) {
                var length = 101;
                var overlay = element.children('.tile-overlay');
                var image = element.children('.tile-image');
                if(scope.image.popular) {
                    element.addClass('big-tile');
                    length = 206;
                }
                element.hover(function() {
                    overlay.fadeIn(100);
                }, function() {
                    overlay.fadeOut(100);
                });
                
                function onImageLoad() { // When the image is loaded
                    element.css('background-image','none'); // Remove loading image
                    var realSize = [image.prop('naturalWidth'),image.prop('naturalHeight')]; // Real dimensions
                    console.log('image url:',image.attr('src'));
                    console.log('real size:',realSize);
                    console.log('image props init:',[image.prop('width'),image.prop('height')]);
                    var ratio = realSize[0]/realSize[1];
                    
                    if(ratio > 1) {
                        image.prop({'width':length*ratio,'height':length})
                    } else {
                        image.prop({'width':length,'height':length/ratio})
                    }
                    
                    // Image width isn't small enough to letterbox
                    if(realSize[0] > length*0.8 && ratio < 1) {
                        image.prop({'width':length,'height':length/ratio});
                    }
                    // Image height isn't small enough to letterbox
                    if(realSize[1] > length*0.8 && ratio > 1) {
                        image.prop({'width':length*ratio,'height':length});
                    }
                    console.log('image props after letterbox fix:',[image.prop('width'),image.prop('height')]);

                    var displaySize = [image.prop('width'),image.prop('height')]; // Display dimensions
                    image.css({ // Center the image in the tile
                        'margin-left': displaySize[0]*-0.5,
                        'margin-top': displaySize[1]*-0.5
                    });
                }
                image.load(onImageLoad); // When image loads, check its dimensions
            }
        }
    })
;