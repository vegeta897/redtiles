/* Controllers */

angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', function($scope) {
        
        // Default page controller stuff
        
    }])
    .controller('ImageTiles', ['$scope', '$timeout', '$element', 'reddit', function($scope, $timeout, $element, reddit) {
        
        $scope.imageTiles = [];
        $scope.subreddits = ['pics','funny','1000words','wallpapers'];
        $scope.sortBy = 'hot';

        var imageIDs = [];
        var lastID = '';
        var msnry = null;
        var loadBuffer = true;
        var listCount = 0;
        var imgsLoaded = 0;
        var allImagesLoaded = false;
        var noMoreResults = false;
        
        reddit.getPosts($scope.subreddits, null, listCount, $scope.sortBy).then(function (response) {
            console.log(response);
            for(var i = 0; i < response.posts.length; i++) {
                var postID = response.posts[i].id;
                imageIDs.push(postID);
            }
            lastID = response.after;
            $scope.imageTiles = response.posts;
            $timeout(onLoadBuffer, 2000);
        });
        
        // Executed by directive, sets masonry variable for manipulation in this controller
        this.initMasonry = function initMasonry(element) {
            msnry = element.data('masonry');
        };
        // Append a tile to the masonry layout
        this.appendTile = function appendTile(element) {
            msnry.appended(element);
            imgsLoaded += 1;
            if(imgsLoaded >= $scope.imageTiles.length) {
                allImagesLoaded = true;
            }
        };
        // Remove a tile from tile list and masonry layout
        this.removeTile = function removeTile(id, element) {
            for(var i = 0; i< $scope.imageTiles.length; i++) {
                if($scope.imageTiles[i].id == id) {
                    $scope.imageTiles.splice(i,1);
                    break;
                }
            }
            msnry.remove(element);
            msnry.layout();
        };
        
        var getMoreTiles = function() {
            listCount += 100;
            allImagesLoaded = false;
            reddit.getPosts($scope.subreddits, lastID, listCount, $scope.sortBy).then(function (response) {
                console.log(response);
                var addCount = 0;
                for(var i = 0; i < response.posts.length; i++) {
                    var postID = response.posts[i].id;
                    if(jQuery.inArray(postID,imageIDs) == -1) {
                        addCount += 1;
                        imageIDs.push(postID);
                        $scope.imageTiles.push(response.posts[i]);
                    }
                }
                if(addCount == 0) {
                    noMoreResults = true;
                    console.log('no more results!');
                }
                lastID = response.after;
                console.log('there are',imageIDs.length,'images');
                $timeout(onLoadBuffer, 3000)
            });
        };
        
        // When the load buffer is finished
        var onLoadBuffer = function() {
            console.log('buffer complete');
            loadBuffer = false;
            var jqWindow = $(window);
            var tileArea = $('.tile-area');
            var tileAreaBottom = tileArea.offset().top + tileArea.height();
            var onScroll = function() {
                if(!loadBuffer && allImagesLoaded && !noMoreResults) {
                    checkScroll();
                }
            };
            var checkScroll = function() {
                if(jqWindow.scrollTop() + jqWindow.height() > tileAreaBottom - 100) {
                    loadBuffer = true;
                    getMoreTiles();
                    jqWindow.off('scroll', onScroll);
                }
            };
            onScroll();
            jqWindow.scroll(onScroll);
        };
    }]);