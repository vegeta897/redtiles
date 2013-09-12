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
    .directive('sectionToggle', function() {
        return {
            restrict: 'A',
            link: function(scope, element) {
                var chevron = element.children('h2').find('i');
                var sectionContent = element.children('h2').siblings();
                element.children('h2').click(function() {
                    if(sectionContent.is(':hidden')) { // Reveal
                        chevron.addClass('icon-chevron-down').removeClass('icon-chevron-right')
                            .css('margin-right','8px');
                        sectionContent.slideDown();
                    } else { // Hide
                        chevron.removeClass('icon-chevron-down').addClass('icon-chevron-right')
                            .css('margin-right','13px'); // Adjust spacing from section title
                        sectionContent.slideUp();
                    }
                });
            }
        }
    })
    .directive('sortDrop', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.children('#sortDrop').click(function(event) {
                    var invoker = $parse(attrs.sortFn);
                    invoker(scope, {arg1: event.target.innerText} );
                });
            }
        };
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
                    transitionDuration: '0.3s'
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
//            scope: {
//                displaySize: '='
//            },
            link: function(scope, element, attrs, ctrl) {
                var length = 101;
                var overlay = element.children('.tile-overlay');
                var image = element.children('.tile-image');
                var realSize = [];
                var ratio = 0;
                // Applies/removes tile size classes depending on image's display size
                var applySize = function() {
                    switch(scope.image.displaySize) {
                        case 'small':
                            element.removeClass('big-tile');
                            element.removeClass('huge-tile');
                            length = 101;
                            break;
                        case 'big':
                            element.addClass('big-tile');
                            element.removeClass('huge-tile');
                            length = 206;
                            break;
                        case 'huge':
                            element.addClass('big-tile');
                            element.addClass('huge-tile');
                            length = 311;
                            break;
                    }
                };
                // Fits the image inside tile, scaling and cropping as necessary
                var fitImage = function() {
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

                    image.css({ // Center the image in the tile
                        'margin-left': image.prop('width')*-0.5,
                        'margin-top': image.prop('height')*-0.5
                    });
                };
                applySize(); // Apply on first load
                // Apply new classes and refit images when image's display size changes
                attrs.$observe('displaySize',function(){
                    applySize();
                    fitImage();
                });
                // Show overlay when hovering on image
                element.hover(function() {
                    overlay.fadeIn(100);
                }, function() {
                    overlay.fadeOut(100);
                });
                
                function onImageLoad() { // When the image is loaded
                    realSize = [image.prop('naturalWidth'),image.prop('naturalHeight')]; // Real dimensions
                    if(realSize[0] == 0) { // If image failed to load, don't add tile
                        ctrl.removeTile(element);
                        console.log('post id',element.attr('id'),'did not load');
                        return;
                    }
                    image.css('visibility','visible');
                    ratio = realSize[0]/realSize[1]; // Width/height ratio
                    fitImage(); // Fit image inside tile
                    overlay.click(function(e) {
                        e.stopPropagation();
                        if(e.target == overlay.get()[0]) { // Make sure nothing else was clicked
                        //    $('#modalImage').foundation('reveal', 'open');
                            var imageIndex = jQuery.inArray(element.attr('id'), scope.imageIDs);
                            $.fancybox.open(scope.fullImages, { index: imageIndex });
                        }
                    })
                }
                element.css('display','block'); // Display tile
                ctrl.appendTile(element); // Append tile to masonry
                element.imagesLoaded(onImageLoad); // When image loads...
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
    .directive('subredditAutocomplete', function () {
        return function (scope, element, attrs) {
            element.autocomplete({
                lookup: ['pics','pictures','itookapicture','awwwnime','gifs','cosplay','wallpapers','memes','fffffffuuuuuuuuuuuu','aww','wtf','gaming','earthporn','roomporn','food','art','woahdude','comics','4chan','abandonedporn','cars','cats','cityporn','albumartporn','firstworldanarchists','foodporn','gentlemanboners','ladyboners','graffiti','humanporn','historyporn','machineporn','mapporn','quotesporn','spaceporn','tattoos','adviceanimals','lolcats','ecards','boardgames','books','circlejerk','creepy','facepalm','cringepics','freebies','frugal','geek','getmotivated','history','humor','jokes','justiceporn','shutupandtakemymoney','offbeat','philosophy','photography','nosleep','scifi'],
                onSelect: function (suggestion) {
                    // When a suggestion is selected
                    scope.addSubName = suggestion.value;
                }
            });
        };
    })
;