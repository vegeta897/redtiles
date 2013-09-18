/* Controllers */
'use strict';
angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', function($scope) {

        // Default page controller stuff
        
    }])
    .controller('ImageTiles', ['$scope', '$timeout', '$element', 'reddit', 'localStorageService', function($scope, $timeout, $element, reddit, localStorageService) {

        var gathering = false; // Keeps track of whether an API request is in process
        var lastID = null; // Last image ID, used in reddit API request
        var msnry = null; // Stores the masonry instance for image tiles
        var imagesAdded = 0; // Number of images added to masonry
        var allImagesAdded = false; // Indicates whether all images were added
        var noMoreResults = false; // Indicates whether there are any more results to get
        var loadBuffer = true; // If true, prevents another API call
        var session = false; // Indicates whether a reddit session is active

        var jqWindow = $(window); // jQuery object for the window
        var htmlBody = $('html, body');
        var tileArea = $('.tile-area'); // jQuery object for the tile area
        
        $scope.imageTiles = []; // List of image tiles currently loaded/shown
        $scope.imageIDs = []; // List of image IDs currently loaded/shown
        $scope.fullImages = []; // List of full size URLs to images, used in FancyBox image display
        $scope.subreddits = ['pics','funny','1000words','wallpapers']; // Default collection
        $scope.popularSubs = ['itookapicture','gifs','pictures','tumblr','awwnime','cosplay','pics','cats','art']; // Placeholder
        $scope.sortBy = 'Hot'; // Sort parameter used in reddit API request
        $scope.loadStatus = 'loading...'; // Status text displayed to user
        $scope.addSubName = ''; // Name of subreddit being added in input field
        $scope.addSubToggle = false; // Watched by blurring directive, to blur the input field on submission
        $scope.sizeLevel = 2; // Image tile size, from 0 to 4
        $scope.loginStatus = ''; // Track log-in status, eg. 'logging' 'badPass' 'missingFields'

        // LocalStorage initialization TODO: Make this a looping array of params
        if(localStorageService.get('defaultSubreddits')) { // Check for subreddits in localstorage/cookies
            $scope.subreddits = localStorageService.get('defaultSubreddits'); // Get subreddits
        } else { // If not found, initialize
            localStorageService.set('defaultSubreddits',$scope.subreddits); // Set subreddits
        }
        if(localStorageService.get('defaultSize')) { // Check for sizeLevel in localstorage/cookies
            $scope.sizeLevel = parseInt(localStorageService.get('defaultSize')); // Get sizeLevel
        } else { // If not found, initialize
            localStorageService.set('defaultSize',$scope.sizeLevel); // Set sizeLevel
        }
        // Check for reddit user info
        if(localStorageService.get('redditUser')) { // Check for redditUser in localstorage/cookies
            $scope.redditUser = localStorageService.get('redditUser'); // Get redditUser
            if($scope.redditUser == null) { // If the user object is null, remove user and session
                localStorageService.remove('redditUser'); // Remove redditUser from localstorage/cookies
                localStorageService.remove('redditSession'); // Remove session from localstorage/cookies
            }
        }
        // Check for reddit session info
        if(localStorageService.get('redditSession')) { // Check for redditSession in localstorage/cookies
            session = true; // Session found
            var redditSession = localStorageService.get('redditSession'); // Get redditSession
            reddit.autoLogin(redditSession.modhash, redditSession.cookie).then(function(response) {
                console.log('Resuming session');
                $scope.loginStatus = 'logged';
                getTiles(); // Get tiles when session is resumed
            });
        }
        if(!session) { $scope.loginStatus = 'notLogged'; } // If no session was found, we're not logged in
        
        // When clicking on an image for full view
        $scope.viewImage = function(img) {
            $scope.imageViewed = img;
        };
        // Authenticates the user with reddit
        $scope.login = function(username, password) {
            $scope.loginStatus = 'logging';
            reddit.login(username,password).then(function(response) {
                console.log(response);
                if(!response.hasOwnProperty('session')) {
                    $scope.loginStatus = 'missingFields';
                    return;
                }
                var sess = response.session;
                if(sess[0] == 'WRONG_PASSWORD') { // Bad password
                    $scope.loginStatus = 'badPass';
                    return;
                }
                if(sess[0] == 'RATELIMIT') { // Too many login requests
                    var wait = sess[1].substring(sess[1].indexOf('try again')+13,sess[1].length);
                    $scope.loginStatus = 'rateLimit' + wait;
                    return;
                }
                if(!response.hasOwnProperty('userInfo')) { // Some other unhandled error
                    $scope.loginStatus = 'unknownError';
                    return;
                }
                $scope.loginStatus = 'logged'; // If none of the above conditions were met, login was successful
                $scope.redditUser = response.userInfo['data'];
                localStorageService.set('redditUser',$scope.redditUser); // Set redditUser
                localStorageService.set('redditSession',response.session); // Set redditSession
            });
        };
        // Log the user out of reddit
        $scope.logout = function() {
            reddit.logout().then(function(response) {
                console.log(response);
                $scope.loginStatus = 'notLogged';
                $scope.redditUser = null;
                localStorageService.remove('redditUser'); // Remove redditUser from localstorage/cookies
                localStorageService.remove('redditSession'); // Remove session from localstorage/cookies
            });
        };
        // Votes on a post through reddit
        $scope.vote = function(img, dir) {
            if(img.voted == dir) { // If the image was already voted on
                img.score -= dir; // Undo the score change
                dir = 0; // Passing dir 0 into vote function will cancel the previous vote
            } else if(img.voted == dir*-1) { // If the image was already voted in the opposite direction
                img.score += dir*2; // Increment twice to undo previous and apply the vote
            } else {
                img.score += dir; // Apply the vote score change
            }
            img.voted = dir; // Indicate the image was voted on, or voting undone
            reddit.vote(img.name,dir).then(function(response) { // Send the vote request to reddit
                if(jQuery.isEmptyObject(response)) {
                    console.log('vote successful!');
                } else {
                    console.log('vote failed!');
                }
            });
        };
        // Favorites or un-favorites a post through reddit
        $scope.fave = function(img) {
            var unfaving = img.saved ? true : false; // Is the image already faved? (are we unfaving?)
            img.saved = !unfaving; // Set fave state
            var methodName = 'fave'; // By default the method will fave the image
            if(unfaving) { methodName = 'unfave'; } // If we're unfaving, change the method
            reddit[methodName](img.name).then(function(response) { // Send the vote request to reddit
                if(jQuery.isEmptyObject(response)) {
                    console.log('fave successful!');
                } else {
                    console.log('fave failed!');
                }
            });
        };
        // When a user clicks the hide button on a tile
        $scope.hideTile = function(imgID) {
            that.removeTile($('#'+imgID)); // Remove the tile from the masonry layout
            if($scope.loginStatus == 'logged') { // If we're logged in
                reddit.hide('t3_'+imgID); // Hide the image on the user's reddit account
            }
        };
        // When a new sort option is selected
        $scope.updateSort = function(sortby) {
            console.log('sorting by:',sortby);
            $timeout(function() { // Using timeout to force scope refresh
                $scope.sortBy = sortby;
            }, 0);
            if($scope.subreddits.length == 0) { return; }
            clearTiles();
            getTiles();
        };
        // When one of the sizing buttons are clicked (amount is -1 or 1)
        $scope.changeSize = function(amount) {
            var oldSize = $scope.sizeLevel;
            var newSize = oldSize + amount; // Apply the size change
            // Undo any changes that put the size out of bounds
            newSize = newSize < 0 ? 0 : newSize;
            newSize = newSize > 4 ? 4 : newSize;
            if(oldSize == newSize) { return; } // Abort here if size didn't change
            $scope.sizeLevel = newSize; // Apply the new size to scope
            localStorageService.set('defaultSize',$scope.sizeLevel); // Store sizeLevel
            for(var i = 0; i < $scope.imageTiles.length; i++) {
                $scope.imageTiles[i].displaySize = getPostSize($scope.imageTiles[i]);
            }
            $timeout(function() { msnry.layout(); },0); // Re-layout tiles after css changes take effect
        };
        $scope.addSub = function(sub) {
            $scope.addSubName = sub.toLowerCase();
            // If sub name not empty and not already in sub list
            if($scope.addSubName !== '' && jQuery.inArray($scope.addSubName,$scope.subreddits) == -1) {
                $scope.subreddits.push($scope.addSubName); // Add subreddit to collection
                localStorageService.set('defaultSubreddits',$scope.subreddits); // Store in localstorage
                $scope.addSubName = ''; // Clear the field
                $scope.addSubToggle = !$scope.addSubToggle; // Blur the field
                clearTiles();
                getTiles();
            }
        };
        $scope.removeSub = function(sub) {
        //    if($scope.subreddits.length == 1) { return; } // Cancel if last subreddit
            var position = jQuery.inArray(sub,$scope.subreddits);
            if(position > -1) { // If in the sub list
                $scope.subreddits.splice(position,1); // remove subreddit from collection
                localStorageService.set('defaultSubreddits',$scope.subreddits);
                if($scope.subreddits.length >= 1) {
                    clearTiles();
                    getTiles();
                }
            }
        };
        // Filters out subreddits already in collection from the popular subs list
        $scope.filterPopular = function(item) {
            return jQuery.inArray(item,$scope.subreddits) < 0;
        };
        // Determine post size based on sizeLevel
        var getPostSize = function(post) {
            var displaySize = '';
            switch($scope.sizeLevel) {
                case 0: // All small
                    displaySize = 'small';
                    break;
                case 1: // Big is small, huge is big
                    displaySize = post.superPopular ? 'big' : 'small';
                    break;
                case 2: // Default
                    displaySize = post.superPopular ? 'huge' : post.popular ? 'big' : 'small';
                    break;
                case 3: // Small is big
                    displaySize = post.superPopular ? 'huge' : 'big';
                    break;
                case 4: // All huge
                    displaySize = 'huge';
                    break;
            }
            return displaySize;
        };
        // Clear tile area and reset necessary variables
        var clearTiles = function() {
            $timeout(function() { // Using timeout to force scope refresh
                $scope.loadStatus = 'loading...';
            }, 0);
            htmlBody.animate({ scrollTop: 0 }, "slow"); // Scroll to top of page
            lastID = null;
            noMoreResults = false;
            imagesAdded = 0;
            $scope.imageTiles = [];
            $scope.imageIDs = [];
            $scope.fullImages = [];
            msnry.remove(msnry.getItemElements());
            msnry.layout();
        };
        // Function run when there are no more results
        var onLastResults = function() {
            noMoreResults = true;
            console.log('no more results!');
            $scope.loadStatus = 'no more images to load!'; // Tell the user
        };
        // Get posts from reddit
        var getTiles = function() {
            if(gathering) { return; }
            if($scope.subreddits.length == 0) {
                $scope.loadStatus = 'add some subreddits!';
                return;
            }
            gathering = true;
            allImagesAdded = false;
            loadBuffer = true;
            // Refresh masonry layout to fill any gaps left by previous deletions
            if(imagesAdded > 0) { msnry.layout(); }
            var getMethod = 'getPosts'; // Use jsonp for getting posts by default
            if($scope.loginStatus == 'logged') { getMethod = 'phpGetPosts' } // If we're logged in, use PHP for getting posts
            reddit[getMethod]($scope.subreddits, $scope.sortBy, 100, lastID).then(function (response) {
                $scope.loadStatus = '';
                $timeout(onLoadBuffer, 2500); // Can't make a request for 2.5 seconds
                console.log(response);
                if(response.hasOwnProperty('error')) { // If there was an error
                    $scope.loadStatus = 'oops... try again';
                    gathering = false;
                    return;
                }
                lastID = response['after'];
                if(response.posts.length == 0) { // No more results if there are no posts
                    onLastResults();
                    return;
                }

                var addCount = 0; // Keeps track of how many posts are added to the tile pool
                // Iterate through each post in the response
                for(var i = 0; i < response.posts.length; i++) {
                    var post = response.posts[i];
                    var postID = post.id;
                    if(jQuery.inArray(postID,$scope.imageIDs) == -1) { // If image isn't already in pool
                        addCount += 1;
                        post.displaySize = getPostSize(post);
                        $scope.imageTiles.push(post);
                        $scope.imageIDs.push(postID);
                        $scope.fullImages.push({
                            href: post.fixedURL,
                            title: post.title
                        })
                    }
                }
                if(addCount == 0) { onLastResults(); } // Check if no new images were in the response
                gathering = false;
                console.log('added',addCount,'- there are',$scope.imageIDs.length,'image tiles');
            });
        };
        
        if(!session) { console.log('No session'); getTiles(); } // Get tiles when app starts if there is no session
        
        // Executed by directive, sets masonry variable for manipulation in this controller
        this.initMasonry = function initMasonry(element) {
            msnry = element.data('masonry');
        };
        // Append a tile to the masonry layout
        this.appendTile = function appendTile(element) {
            imagesAdded += 1;
            msnry.appended(element);
            if(imagesAdded >= $scope.imageTiles.length) {
                allImagesAdded = true;
                msnry.layout();
            }
        };
        // Remove a tile from tile list and masonry layout
        this.removeTile = function removeTile(element) {
            msnry.remove(element);
            msnry.layout();
            onScroll(); // Manually fire the onScroll method
        };
        this.reLayout = function reLayout() {
            msnry.layout();
        };
        // Function run on each scroll event to determine whether to get more images
        var onScroll = function() {
            var tileAreaBottom = tileArea.offset().top + tileArea.height();
            if(jqWindow.scrollTop() + jqWindow.height() > tileAreaBottom - 100) {
                if(!noMoreResults) {
                    $timeout(function() { // Using timeout to force scope refresh
                        $scope.loadStatus = 'loading more...';
                    }, 0);
                    // Get more tiles if all images are loaded and load buffer ended
                    if(!loadBuffer) { console.log('loading more');getTiles(); } 
                }
                
            }
        };
        jqWindow.scroll(onScroll); // Bind scrolling to onScroll function
        
        // When the load buffer is finished
        var onLoadBuffer = function() {
            loadBuffer = false;
            onScroll(); // Manually fire the onScroll method
        };

        var that = this; // Store the this.functions in a variable that other functions can access
    }])
;