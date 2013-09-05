/* Directives and Filters */

angular.module('Redtiles.directives', [])
    .directive('tile', function() {
        return {
            restrict: 'C',
            link: function(scope, element, attrs) {
                var length = 101;
                var overlay = element.children('.tile-overlay');
                if(scope.image.popular) {
                    element.addClass('big-tile');
                    length = 206;
                }
                element.hover(function() {
                    overlay.fadeIn(100);
                }, function() {
                    overlay.fadeOut(100);
                });
                element.children('.tile-image').css('background-image', 'url(\'' + 
                    scope.image.thumbURL + '\')');

                function onImageLoad() { // When the image is loaded
                    var realPic = element.children('.image-placeholder'); // Define the real picture
                    realPic.attr('src',scope.image.thumbURL); // Set the src of the image to the real pic
                    var dimensions = [realPic.prop('width'),realPic.prop('height')]; // Define dimensions
                    if(dimensions[0] < length*0.8 || dimensions[1] < length*0.8) { // Width or height too small
                        element.children('.tile-image') // Letterbox image
                            .css('background-size',dimensions[0] + 'px ' + dimensions[1] + 'px');
                    }
                }
                element.imagesLoaded(onImageLoad); // When image loads, check its dimensions
            }
        }
    })
;