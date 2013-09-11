/* Controllers */
'use strict';
angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', function($scope) {

        // Default page controller stuff
        
    }])
    .controller('ImageTiles', ['$scope', '$timeout', '$element', 'reddit', 'localStorageService',function($scope, $timeout, $element, reddit, localStorageService) {
        
        $scope.imageTiles = [];
        $scope.subreddits = ['pics','funny','1000words','wallpapers'];
        $scope.popularSubs = ['itookapicture','FiftyFifty','tumblr','awwnime','cosplay']; // Placeholder
        $scope.sortBy = 'hot';
        $scope.loadStatus = 'loading...';
        $scope.addSubName = '';
        $scope.addSubToggle = false;

        // LocalStorage initialization
        if(localStorageService.get('defaultSubreddits')) { // Check for subreddits in localstorage/cookies
            $scope.subreddits = localStorageService.get('defaultSubreddits'); // Get subreddits
        } else { // If not found, initialize
            localStorageService.set('defaultSubreddits',$scope.subreddits); // Set subreddits
        }

        var imageIDs = [];
        var lastID = null;
        var msnry = null;
        var imagesAdded = 0;
        var allImagesLoaded = false;
        var noMoreResults = false;
        var loadBuffer = true;
        
        var jqWindow = $(window); // jQuery object for the window
        var htmlBody = $('html, body');
        var tileArea = $('.tile-area'); // jQuery object for the tile area

        $scope.addSub = function(sub) {
            console.log('adding sub!',sub);
            $scope.addSubName = sub;
            // If sub name not empty and not already in sub list
            if($scope.addSubName !== '' && jQuery.inArray($scope.addSubName,$scope.subreddits) == -1) {
                $scope.subreddits.push($scope.addSubName); // Add subreddit to collection
                localStorageService.set('defaultSubreddits',$scope.subreddits);
                $scope.addSubName = '';
                $scope.addSubToggle = !$scope.addSubToggle;
                $timeout(function() { // Using timeout to force scope refresh
                    $scope.loadStatus = 'loading...';
                }, 0);
                clearTiles();
                getTiles();
            }
        };
        $scope.removeSub = function(sub) {
            console.log($scope.subreddits);
            console.log('hello!',$scope.subreddits.length);
            if($scope.subreddits.length == 1) { return; } // Cancel if last subreddit
            var position = jQuery.inArray(sub,$scope.subreddits);
            if(position > -1) { // If in the sub list
                $scope.subreddits.splice(position,1); // remove subreddit from collection
                localStorageService.set('defaultSubreddits',$scope.subreddits);
                $timeout(function() { // Using timeout to force scope refresh
                    $scope.loadStatus = 'loading...';
                }, 0);
                clearTiles();
                getTiles();
            }
        };
        // Filters out subreddits already in collection from the popular subs list
        $scope.filterPopular = function(item) {
            return jQuery.inArray(item,$scope.subreddits) < 0;
        };
        // Clear tile area and reset necessary variables
        var clearTiles = function() {
            htmlBody.animate({ scrollTop: 0 }, "slow"); // Scroll to top of page
            lastID = null;
            noMoreResults = false;
            imagesAdded = 0;
            $scope.imageTiles = [];
            imageIDs = [];
            msnry.remove(msnry.getItemElements());
            msnry.layout();
        };
        // Function run when there are no more results
        var onLastResults = function() {
            noMoreResults = true;
            console.log('no more results!');
            $scope.loadStatus = 'no more images to load!'; // Tell the user
        };
        // Get posts from reddit. Remixing argument is for adding/subtracting subreddits from collection
        var getTiles = function() {
            allImagesLoaded = false;
            loadBuffer = true;
            // Refresh masonry layout to fill any gaps left by previous deletions
            if(imagesAdded > 0) { msnry.layout(); }
            reddit.getPosts($scope.subreddits, lastID, $scope.sortBy).then(function (response) {
                $scope.loadStatus = '';
                $timeout(onLoadBuffer, 4000); // Can't make a request for 4 seconds
                console.log(response);
                lastID = response['after'];
                if(response.posts.length == 0) { // No more results if there are no posts
                    onLastResults();
                    return;
                }

                var addCount = 0; // Keeps track of how many posts are added to the tile pool
                // Iterate through each post in the response
                for(var i = 0; i < response.posts.length; i++) {
                    var postID = response.posts[i].id;
                    if(jQuery.inArray(postID,imageIDs) == -1) { // If image isn't already in pool
                        addCount += 1;
                        $scope.imageTiles.push(response.posts[i]);
                        imageIDs.push(postID);
                    }
                }
                if(addCount == 0) { onLastResults(); } // Check if no new images were in the response
                
                console.log('added',addCount,'- there are',imageIDs.length,'image tiles');
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
                console.log('retiling');
                allImagesLoaded = true;
                msnry.layout();
            }
        };
        // Remove a tile from tile list and masonry layout
        this.removeTile = function removeTile(element) {
//            for(var i = 0; i< $scope.imageTiles.length; i++) {
//                if($scope.imageTiles[i].id == id) {
//                    $scope.imageTiles[i]['disabled'] = true;
//                    break;
//                }
//            }
            msnry.remove(element);
//            msnry.layout();
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
    }]);