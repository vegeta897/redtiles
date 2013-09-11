/* Directives and Filters */

angular.module('Redtiles.directives', [])
    .directive('hover', function() {
        return {
            restrict: 'A',
            link: function(scope, element) {
                element.hover(function() {
                    element.children('i').toggleClass('hover')
                });
            }
        }
    })
    .directive('preventDefault', function() {
        return {
            restrict: 'A',
            link: function(scope, element) {
                element.click(function(event) {
                    event.preventDefault();
                });
            }
        }
    })
    .directive('tileArea', function() {
        return {
            restrict: 'C',
            controller: 'ImageTiles',
            link: function(scope, element, attrs, ctrl) {
                var attrOptions = scope.$eval(attrs.options);
                var options = angular.extend(attrOptions || {}, {
                    itemSelector: attrOptions.itemSelector || '.tile',
                    columnWidth: attrOptions.columnWidth,
                    gutter: attrOptions.gutter,
                    transitionDuration: '0.6s'
                });
                element.masonry(options);
                ctrl.initMasonry(element);
            }
        }
    })
    .directive('tile', function() {
        return {
            restrict: 'C',
            require: '^tileArea',
            link: function(scope, element, attrs, ctrl) {
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
                    var realSize = [image.prop('naturalWidth'),image.prop('naturalHeight')]; // Real dimensions
                    if(realSize[0] == 0) { // If the image failed to load, don't add the tile
                        ctrl.removeTile(element);
                        console.log('post id',element.attr('id'),'did not load');
                        return;
                    }
                    image.css('visibility','visible');
                    var ratio = realSize[0]/realSize[1]; // Width/height ratio
                    // Size image in frame based on ratio
                    if(ratio > 1) {
                        var maxHeight = Math.min(realSize[1],length);
                        image.prop({'width':maxHeight*ratio,'height':maxHeight})
                    } else {
                        var maxWidth = Math.min(realSize[0],length);
                        image.prop({'width':maxWidth,'height':maxWidth/ratio})
                    }
                    // Image width isn't small enough to letterbox
                    if(realSize[0] > length*0.8 && ratio < 1) {
                        image.prop({'width':length,'height':length/ratio});
                    }
                    // Image height isn't small enough to letterbox
                    if(realSize[1] > length*0.8 && ratio > 1) {
                        image.prop({'width':length*ratio,'height':length});
                    }

                    var displaySize = [image.prop('width'),image.prop('height')]; // Display dimensions
                    image.css({ // Center the image in the tile
                        'margin-left': displaySize[0]*-0.5,
                        'margin-top': displaySize[1]*-0.5
                    });
                }
                element.css('display','block'); // Display the tile
                ctrl.appendTile(element); // Append tile to masonry
                element.imagesLoaded(onImageLoad); // When the image loads...
            }
        }
    })
    .directive('loadStatus', function() {
        return {
            restrict: 'C',
            require: '^tileArea',
            link: function(scope, element) {
                var container = element.parent();
                var onResize = function() {
                    element.css({'top':container.height()+20});
                };
                container.resize(onResize); // Keep at bottom of container
            }
        }
    })
    .directive('blur', function () {
        return function (scope, element, attrs) {
            scope.$watch(attrs.blur, function () {
                element[0].blur();
            });
        };
    })
;