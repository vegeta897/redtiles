/* Controllers */
'use strict';
angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', function($scope) {

        // Default page controller stuff
        
    }])
    .controller('ImageTiles', ['$scope', '$timeout', '$element', 'reddit', 'localStorageService',function($scope, $timeout, $element, reddit, localStorageService) {
        
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

        var gathering = false; // Keeps track of whether an API request is in process
        var lastID = null; // Last image ID, used in reddit API request
        var msnry = null; // Stores the masonry instance for image tiles
        var imagesAdded = 0; // Number of images added to masonry
        var allImagesAdded = false; // Indicates whether all images were added
        var noMoreResults = false; // Indicates whether there are any more results to get
        var loadBuffer = true; // If true, prevents another API call
        
        var jqWindow = $(window); // jQuery object for the window
        var htmlBody = $('html, body');
        var tileArea = $('.tile-area'); // jQuery object for the tile area
        $scope.viewImage = function(img) {
            $scope.imageViewed = img;
        };
        // When a user clicks the hide button on a tile
        $scope.hideTile = function(imgID) {
            that.removeTile($('#'+imgID)); // Remove the tile from the masonry layout
            // TODO: Mark this post as hidden on the user's reddit account
        };
        // When a new sort option is selected
        $scope.updateSort = function(sortby) {
            console.log('sorting by:',sortby);
            $scope.sortBy = sortby;
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
            $timeout(function() { msnry.layout(); },0) // Re-layout tiles after css changes take effect
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
            if($scope.subreddits.length == 1) { return; } // Cancel if last subreddit
            var position = jQuery.inArray(sub,$scope.subreddits);
            if(position > -1) { // If in the sub list
                $scope.subreddits.splice(position,1); // remove subreddit from collection
                localStorageService.set('defaultSubreddits',$scope.subreddits);
                clearTiles();
                getTiles();
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
            gathering = true;
            allImagesAdded = false;
            loadBuffer = true;
            // Refresh masonry layout to fill any gaps left by previous deletions
            if(imagesAdded > 0) { msnry.layout(); }
            reddit.getPosts($scope.subreddits, 100, lastID, $scope.sortBy).then(function (response) {
                $scope.loadStatus = '';
                $timeout(onLoadBuffer, 2500); // Can't make a request for 2.5 seconds
                console.log(response);
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
        
        getTiles(); // Get tiles when app starts
        
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