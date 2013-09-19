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
    .directive('customDrop', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.children('.f-dropdown').click(function(event) {
                    var invoker = $parse(attrs.callbackFn);
                    invoker(scope, {arg1: event.target.innerText} );
                });
            }
        };
    })
    .directive('zurbSelect', function(){
        return {
            scope: {
                clickCallback: '&',
                options: '=',
                selected: '='
            },
            restrict: 'E',
            templateUrl: 'partials/collection-select.html',
            link: function(scope, element, attr) {
                scope.selectId = attr.selectId; // Pass in the ID
                element.click(function(event) { // Open the dropdown menu on click
                    scope.menuOpen = !scope.menuOpen;
                });
            }
        };
    })
    .directive('popSelect', function(){
        return {
            scope: {
                clickCallback: '&',
                options: '='
            },
            restrict: 'E',
            templateUrl: 'partials/popular-select.html',
            link: function(scope, element, attr) {
                scope.selectId = attr.selectId; // Pass in the ID
                element.click(function(event) { // Open the dropdown menu on click
                    scope.menuOpen = !scope.menuOpen;
                });
            }
        };
    })
    .directive('loginForm', function() {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                var errorMessage = ''; // Error message to show
                var errorDisplay = element.find('#loginError'); // p element to display error message
                var errorIcon = errorDisplay.html(); // Error icon html (in p element at start)
                var userInput = element.find('#inputLoginUser');
                var passInput = element.find('#inputLoginPass');
                var loginButton = element.find('#loginSubmit'); // The log in button
                attrs.$observe('loginForm',function(){
                    loginButton.removeClass('disabled'); // Remove disabled/error classes
                    userInput.removeClass('error');
                    passInput.removeClass('error');
                    var status = scope.loginStatus;
                    if(status == '') { return; }
                    console.log(status);
                    switch(status) {
                        case 'notLogged':
                            loginButton.removeClass('disabled');
                            passInput.val('');
                            errorMessage = '';
                            break;
                        case 'logged':
                            element.foundation('reveal', 'close');
                            break;
                        case 'logging':
                            loginButton.addClass('disabled');
                            break;
                        case 'missingFields':
                            errorMessage = 'Please fill in both fields.';
                            if(jQuery.trim(userInput.val()) == '') { // User input blank
                                userInput.addClass('error');
                            }
                            if(jQuery.trim(passInput.val()) == '') { // Password input blank
                                passInput.addClass('error');
                            }
                            // If we got this error despite having both fields filled, there was an unknown error
                            if(jQuery.trim(userInput.val()) != '' && jQuery.trim(passInput.val()) != '') {
                                errorMessage = 'Oops... something bad happened. Please try again.';
                            }
                            break;
                        case 'badPass':
                            errorMessage = 'Wrong password. Please try again.';
                            passInput.addClass('error');
                            break;
                        case 'unknownError':
                            errorMessage = 'Oops... something bad happened. Please try again.';
                            break;
                    }
                    if(status.substr(0,9) == 'rateLimit') {
                        var wait = status.substring(9);
                        errorMessage = 'Sorry, you\'ve tried logging in too many times. Try again in ' + wait;
                    }
                    if(errorMessage.length > 0) { // If there was an error, display it
                        errorDisplay.slideDown(200).html(errorIcon + errorMessage);
                    } else {
                        errorDisplay.slideUp();
                    }
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
                var modalCollections = $('#modalCollections');
                modalCollections.find('#renameButton').click(function() {
                    setInterval(function(){modalCollections.find('#renameInput').focus();},50);
                });
                var saveAsNewLink = $('#saveAsNewLink');
                saveAsNewLink.click(function() {
                    saveAsNewLink.siblings('form').children('input').focus();
                });
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
                // Update fave icon when image is faved or un-faved
                attrs.$observe('faved',function(){
                    var removeClass = scope.image.saved ? 'icon-star-empty' : 'icon-star';
                    var addClass = scope.image.saved ? 'icon-star' : 'icon-star-empty';
                    overlay.children('.add-favorite').children('i').removeClass(removeClass).addClass(addClass);
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
                lookup: ['pics','pictures','tumblr','itookapicture','awwwnime','gifs','cosplay','wallpapers','memes','fffffffuuuuuuuuuuuu','aww','wtf','gaming','earthporn','roomporn','food','art','woahdude','comics','4chan','abandonedporn','cars','cats','cityporn','albumartporn','firstworldanarchists','foodporn','gentlemanboners','ladyboners','graffiti','humanporn','historyporn','machineporn','mapporn','quotesporn','spaceporn','tattoos','adviceanimals','lolcats','ecards','boardgames','books','circlejerk','creepy','facepalm','cringepics','freebies','frugal','geek','getmotivated','history','humor','jokes','justiceporn','shutupandtakemymoney','offbeat','philosophy','photography','nosleep','scifi'],
                onSelect: function (suggestion) {
                    // When a suggestion is selected
                    if(element.attr('name') == 'addSubInput') {
                        scope.addSubName = suggestion.value;
                    } else {
                        scope.addEditSubName = suggestion.value;
                    }
                }
            });
        };
    })
    .filter('startFrom', function() {
        return function(input, start) {
            start = +start; //parse to int
            return input.slice(start);
        }
    });
;