/* Controllers */
'use strict';
angular.module('Redtiles.controllers', [])
	.controller('Default', ['$scope', function($scope) {

        // Default page controller stuff
        
    }])
    .controller('ImageTiles', ['$scope', '$timeout', '$element', '$routeParams', '$location', 'reddit', 'utility', 'localStorageService', function($scope, $timeout, $element, $routeParams, $location, reddit, utility, localStorageService) {
        
        var gathering = false; // Keeps track of whether an API request is in process
        var lastID = null; // Last image ID, used in reddit API request
        var msnry = null; // Stores the masonry instance for image tiles
        var imagesAdded = 0; // Number of images added to masonry
        var allImagesAdded = false; // Indicates whether all images were added
        var noMoreResults = false; // Indicates whether there are any more results to get
        var loadBuffer = true; // If true, prevents another API call
        var session = false; // Indicates whether a reddit session is active
        var edited = false; // Indicates whether an edit was made in the collection manager
        var gettingShared = $routeParams['user'] && $routeParams['collection'] ? true : false; // Share URL?

        var jqWindow = $(window); // jQuery object for the window
        var htmlBody = $('html, body');
        var tileArea = $('.tile-area'); // jQuery object for the tile area

        // Create a reference to firebase for storing and retrieving user's collections
        var fireRef = new Firebase('https://redtiles.firebaseio.com');

        $scope.selectedColl = 'Default Collection'; // Default selected collection name
        $scope.collections = []; // Collections array
        $scope.collections.push({name:$scope.selectedColl, subs: ['pics','funny','wallpapers']}); // Add default
        $scope.subreddits = []; // Holds the currently viewed subreddits
        $scope.editSelectedColl = ''; // Name of the selected collection in the manager
        $scope.editCollections = []; // Holds collections in the manager
        $scope.editSubreddits = []; // Holds subreddits in selected collection in the manager
        $scope.imageTiles = []; // List of image tiles currently loaded/shown
        $scope.imageIDs = []; // List of image IDs currently loaded/shown
        $scope.fullImages = []; // List of full size URLs to images, used in FancyBox image display
        $scope.popularSubs = []; // Holds ordered list of popular subs, acquired from firebase
        $scope.popularEditSubs = []; // Same as above but for collection manager, manually filtered
        $scope.currentPopPage = 0; // Holds which page of popular subs we're on in the sidebar
        $scope.totalPopPages = 1; // How many pages are in the popular list (updated when list is updated)
        $scope.sortBy = 'Hot'; // Sort parameter used in reddit API request
        $scope.loadStatus = 'loading...'; // Status text displayed to user
        $scope.addSubName = ''; // Name of subreddit being added in input field
        $scope.addSubToggle = false; // Watched by blurring directive, to blur the input field on submission
        $scope.sizeLevel = 2; // Image tile size, from 0 to 4
        $scope.loginStatus = ''; // Track log-in status, eg. 'logging' 'badPass' 'missingFields'
        $scope.popularSelect = 'Select a subreddit';
        $scope.shared = gettingShared;
        $scope.shareURL = ''; // Holds the URL to share the selected collection (when logged in)
        $scope.shareUser = $routeParams['user']; // For displaying who the collection was shared from

        // Links up firebase user - creates user if doesn't exist, gets data if it does
        var connectFireUser = function() {
            var fireUser = fireRef.child('users').child($scope.redditUser['name']);
            fireUser.once('value', function(user) {
                if(!user.val()) { // If the user doesn't exist, create it
                    fireUser.set( // Using angular.copy to remove hash key properties
                        {collections: angular.copy($scope.collections), selectedColl: $scope.selectedColl}
                    )
                } else {
                    $scope.collections = user.val().collections;
                    $scope.selectedColl = user.val().selectedColl;
                    getSubs(true);
                    localStorageService.set('collections',$scope.collections); // Set collections
                    localStorageService.set('selectedColl',$scope.selectedColl); // Set selected collection
                }
            });
        };
        // When viewing a shared collection URL, this function will grab that collection from firebase
        var getSharedCollection = function() {
            fireRef.child('users').child($routeParams['user']).once('value', function(user) {
                if(user.val()) { // If the user exists on firebase
                    console.log('share URL user found');
                    var shareCollName = $routeParams['collection'];
                    if(user.val().hasOwnProperty('collections')) {
                        var userColls = user.val().collections;
                        for(var i = 0; i < userColls.length; i++) {
                            if(userColls[i]['name'].toLowerCase() == shareCollName.toLowerCase()) {
                                $timeout(function() {
                                    console.log('share URL collection found');
                                    $scope.selectedColl = userColls[i]['name'] + ' (Shared)';
                                    $scope.collections.push({
                                        name: userColls[i]['name'] + ' (Shared)',
                                        subs: userColls[i].subs,
                                        shared: true
                                    });
                                });
                                break;
                            }
                        }
                    }
                }
                gettingShared = false; // We're done (trying) to get the shared collection
                getSubs(true);
            })
        };
        // Check for default size
        if(localStorageService.get('defaultSize')) { // Check for sizeLevel in localstorage/cookies
            $scope.sizeLevel = parseInt(localStorageService.get('defaultSize')); // Get sizeLevel
        }
        // Check for collection list
        if(localStorageService.get('collections')) { // Check for collections in localstorage/cookies
            $scope.collections = localStorageService.get('collections'); // Get collections
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
            $scope.loadStatus = 'logging in...';
            $scope.loginStatus = 'logging';
            var redditSession = localStorageService.get('redditSession'); // Get redditSession
            reddit.generic({action: 'autoLogin', modhash: redditSession.modhash, cookie: redditSession.cookie}).then(function(response) {
                if(!response.hasOwnProperty('data')) { return; }
                $scope.redditUser = response['data'];
                $scope.loadStatus = 'loading...';
                connectFireUser();
                localStorageService.set('redditUser',$scope.redditUser); // Set redditUser
                console.log('Resuming session');
                $scope.loginStatus = 'logged';
            });
        }
        if(!session) { $scope.loginStatus = 'notLogged'; } // If no session was found, we're not logged in
        

        // Clear tile area and reset necessary variables
        var clearTiles = function() {
            $timeout(function() { // Using timeout to force scope refresh
                $scope.loadStatus = 'loading...';
            }, 0);
            htmlBody.animate({ scrollTop: 0 }, "slow"); // Scroll to top of page
            gathering = false;
            lastID = null;
            noMoreResults = false;
            imagesAdded = 0;
            $scope.imageTiles = [];
            $scope.imageIDs = [];
            $scope.fullImages = [];
            msnry.remove(msnry.getItemElements());
            msnry.layout();
        };
        // Get posts from reddit
        var getTiles = function() {
            if(gathering) { return; }
            if(!$scope.subreddits || $scope.subreddits.length == 0) {
                $scope.subreddits = [];
                $timeout(function(){$scope.loadStatus = 'add some subreddits!';});
                return;
            }
            gathering = true;
            allImagesAdded = false;
            loadBuffer = true;
            // Refresh masonry layout to fill any gaps left by previous deletions
            if(imagesAdded > 0) { msnry.layout(); }
            var loggedIn = ($scope.loginStatus == 'logged'); // If we're logged in, use PHP for getting posts
            reddit.getPosts($scope.subreddits, $scope.sortBy, 100, lastID, loggedIn).then(function(response) {
                console.log(response);
                if(response.hasOwnProperty('error') || !response.hasOwnProperty('posts')) { // If there was an error
                    gathering = false;
                    console.log(response.error.description);
                    $timeout(getTiles,1000);
                    return;
                }
                $timeout(onLoadBuffer, 2500); // Can't make a request for 2.5 seconds
                $scope.loadStatus = '';
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
                    // If image isn't already in pool, and not hidden
                    if(jQuery.inArray(postID,$scope.imageIDs) == -1 && !post['hidden']) { 
                        addCount += 1;
                        post.displaySize = getPostSize(post);
                        post.arrayIndex = $scope.imageTiles.length;
                        $scope.imageTiles.push(post);
                        $scope.imageIDs.push(postID);
                        $scope.fullImages.push({
                            href: post.fixedURL,
                            title: post.title
                        });
                        if(post.hasOwnProperty('ajax')) {
                            reddit.imgAjax(postID, post.thumbURL).then(function(response) {
                                var imgIndex = jQuery.inArray(response.id,$scope.imageIDs);
                                if(response.hasOwnProperty('thumbURL')) {
                                    $scope.imageTiles[imgIndex].ajaxed = true;
                                    $scope.imageTiles[imgIndex].thumbURL = response.thumbURL;
                                    $scope.imageTiles[imgIndex].fixedURL = response.fixedURL;
                                    $scope.fullImages[imgIndex].href = response.fixedURL;
                                } else {
                                    console.log('AJAX image couldn\'t be resolved');
                                    // Remove the tile from the masonry layout
                                    that.removeTile($('#'+$scope.imageTiles[imgIndex].id)); 
                                }
                            });
                        }
                    }
                }
                if(addCount == 0) { onLastResults(); } // Check if no new images were in the response
                gathering = false;
                console.log('added',addCount,'- there are',$scope.imageIDs.length,'image tiles');
            }, function(response) { // On error
                gathering = false;
                console.log('http error:',response.error.description);
                $timeout(getTiles,1000);
            });
        };
        // Populate the subreddits scope property by finding the currently selected collection
        var getSubs = function(gettingTiles) {
            $timeout(function() {
                if($scope.editSelectedColl) { // If we're editing, update the edited subreddit list
                    angular.copy(utility.findByProperty($scope.editCollections,'name',$scope.editSelectedColl).subs, $scope.editSubreddits);
                }
                var theCollection = utility.findByProperty($scope.collections,'name',$scope.selectedColl);
                // If the selected collection is found in the collections, load its subreddits
                if(!theCollection.hasOwnProperty('subs')) {
                    $scope.subreddits = [];
                } else {
                    $scope.shared = theCollection.hasOwnProperty('shared');
                    $scope.subreddits = JSON.parse(JSON.stringify(theCollection.subs));
                }
                if($scope.loginStatus == 'logged') { // If logged in...
                    $scope.shareURL = $location.host() + '/redtiles/#/' + // Build share URL
                        $scope.redditUser.name + '/c/' + encodeURI($scope.selectedColl);
                }
                if(gettingShared) { // If we're viewing a share URL, get the shared collection
                    getSharedCollection();
                    return; // End function here, because getSharedCollection will run getTiles again
                }
                // If function was called with true argument, and there are subreddits in collection, get tiles
                if(gettingTiles && $scope.subreddits.length > 0) { 
                    if($scope.imageTiles.length > 0) { clearTiles(); }
                    getTiles();
                }
            });
            
        };
        // If not logged populate the active subreddit list on app start
        if(!session) {getSubs(true);} 
        
        // Store the subreddits into the collections property, and save that to localstorage and firebase
        var storeSubs = function() {
            var nonShared = []; // Holds a copy of scope.collections but without any shared collections
            for(var i = 0; i < $scope.collections.length; i++) {
                if($scope.collections[i].name == $scope.selectedColl) {
                    $scope.collections[i].subs = $scope.subreddits;
                }
                if(!$scope.collections[i].hasOwnProperty('shared')) { // If not a shared collection...
                    nonShared.push(angular.copy($scope.collections[i])); // Add it to nonShared list
                }
            }
            localStorageService.set('collections',nonShared); // Store collections in localstorage
            if($scope.loginStatus != 'logged') {
                return;
            }
            var fireUser = fireRef.child('users').child($scope.redditUser['name']);
            fireUser.set( // Store collection info in firebase
                {collections: angular.copy(nonShared), selectedColl: $scope.selectedColl}
            );
        };
        
        var getFirePopular = function() {
            // Update the popularSubs ranking in firebase
            fireRef.child('users').once('value', function(fireUsers) {
                var users = fireUsers.val();
                var popularSubs = {};
                for(var userKey in users) {
                    if(users.hasOwnProperty(userKey)) {
                        var user = users[userKey];
                    } else { continue; }
                    for(var j = 0; j < user.collections.length; j++) {
                        var collection = user.collections[j];
                        if(!collection.hasOwnProperty('subs')) { continue; }
                        for(var k = 0; k < collection.subs.length; k++) {
                            var sub = collection.subs[k];
                            if(popularSubs.hasOwnProperty(sub)) {
                                popularSubs[sub] = popularSubs[sub] + 1;
                            } else {
                                popularSubs[sub] = 1;
                            }
                        }
                    }
                }
                fireRef.child('meta').child('popularSubs').set(popularSubs);
                var popularSorted = utility.objToArray(popularSubs);
                popularSorted = utility.sortArrayByProperty(popularSorted,'value',true);
                var popularList = [];
                for(var p = 0; p < popularSorted.length; p++) { // Only count subs with more than 1 occurrence
                    if(popularSorted[p].value > 1) { popularList.push(popularSorted[p].name); }
                }
                $scope.popularSubs = popularList;
                filterPopularSubs();
            });
        };
        getFirePopular(); // Get popular list when app loads

        var filterPopularSubs = function() {
                var tempPop = $scope.popularSubs;
                $scope.popularSubs = [];
                for(var i = 0; i < tempPop.length; i++) {
                    if(jQuery.inArray(tempPop[i],$scope.subreddits) == -1) {
                        $scope.popularSubs.push(tempPop[i]);
                    }
                }
                $scope.currentPopPage = 0;
                $scope.totalPopPages = Math.ceil($scope.popularSubs.length/10);
        };
        
        var filterPopularEditSubs = function() {
            $scope.popularEditSubs = [];
            for(var i = 0; i < $scope.popularSubs.length; i++) {
                if(jQuery.inArray($scope.popularSubs[i],$scope.editSubreddits) == -1) {
                    $scope.popularEditSubs.push($scope.popularSubs[i]);
                }
            }
        };
        
        var updateEditedCollections = function() {
            for(var i = 0; i < $scope.editCollections.length; i++) {
                if($scope.editCollections[i].name == $scope.editSelectedColl) {
                    angular.copy($scope.editSubreddits, $scope.editCollections[i].subs)
                    edited = true;
                    break;
                }
            }
        };
        
        // When clicking on an image for full view
        $scope.viewImage = function(img) {
            $scope.imageViewed = img;
        };
        // Authenticates the user with reddit
        $scope.login = function(username, password) {
            $scope.loginStatus = 'logging';
            reddit.generic({action: 'login', user: username, pass: password}).then(function(response) {
                console.log(response);
                if(!response.hasOwnProperty('session') || response['session'] == null) {
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
                if(!response.hasOwnProperty('userInfo') || !response['userInfo']) { // Some other unhandled error
                    $scope.loginStatus = 'unknownError';
                    return;
                }
                $scope.loginStatus = 'logged'; // If none of the above conditions were met, login was successful
                $scope.redditUser = response.userInfo['data'];
                connectFireUser();
                localStorageService.set('redditUser',$scope.redditUser); // Set redditUser
                localStorageService.set('redditSession',response.session); // Set redditSession
            });
        };
        // Log the user out of reddit
        $scope.logout = function() {
            reddit.generic({action: 'logout'}).then(function(response) {
                console.log(response);
                $scope.loginStatus = 'notLogged';
                $scope.redditUser = null;
                $scope.selectedColl = 'Default Collection'; // Default selected collection name
                $scope.collections = [{name:'Default Collection',subs:$scope.subreddits}]; // Collections array
                localStorageService.set('collections',$scope.collections); // Set collections
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
            var cache = localStorageService.get(img.requestCode); // Get the cache containing this image
            if(cache) { // If it's still there...
                cache.posts[img.arrayIndex].score = img.score; cache.posts[img.arrayIndex].voted = img.voted;
                localStorageService.set(img.requestCode, cache); // Put it back in the cache
            }
            // Send the vote request to reddit
            reddit.generic({action: 'cast_vote', id: img.name, dir: dir}).then(function(response) { 
                if(jQuery.isEmptyObject(response)) {
                    console.log(dir == 1 ? 'up' : dir == -1 ? 'down' : 'undo', 'vote successful!');
                } else { console.log('vote failed!'); }
            });
        };
        // Favorites or un-favorites a post through reddit
        $scope.fave = function(img) {
            var unfaving = img.saved ? true : false; // Is the image already faved? (are we unfaving?)
            img.saved = !unfaving; // Set fave state
            var cache = localStorageService.get(img.requestCode); // Get the cache containing this image
            if(cache) { // If it's still there...
                cache.posts[img.arrayIndex].saved = img.saved;
                localStorageService.set(img.requestCode, cache); // Put it back in the cache
            }
            var methodName = 'fave'; // By default the method will fave the image
            if(unfaving) { methodName = 'unfave'; } // If we're unfaving, change the method
            // Send the fave/unfave request to reddit
            reddit.generic({action: methodName, id: img.name}).then(function(response) { 
                if(jQuery.isEmptyObject(response)) {
                    console.log(unfaving ? 'unfave' : 'fave', 'successful!');
                } else { console.log('fave failed!'); }
            });
        };
        // When a user clicks the hide button on a tile
        $scope.hideTile = function(img) {
            that.removeTile($('#'+img.id)); // Remove the tile from the masonry layout
            img['hidden'] = true;
            var cache = localStorageService.get(img.requestCode); // Get the cache containing this image
            if(cache) { // If it's still there...
                cache.posts[img.arrayIndex]['hidden'] = img['hidden'];
                localStorageService.set(img.requestCode, cache); // Put it back in the cache
            }
            if($scope.loginStatus == 'logged') { // If we're logged in
                reddit.generic({action: 'hide', id: 't3_'+img.id}); // Hide the image on the user's reddit account
            }
        };
        // When a new sort option is selected
        $scope.changeSort = function(sortby) {
            console.log('sorting by:',sortby);
            $timeout(function() { // Using timeout to force scope refresh
                $scope.sortBy = sortby;
                if($scope.subreddits.length == 0) { return; }
                clearTiles();
                getTiles(); // Sorting is a reddit function, so we need to make a new request
            }, 0);
        };
        // When a new collection is selected
        $scope.changeColl = function(coll) {
            $scope.selectedColl = coll;
            getSubs(true);
        };
        // When a new collection is selected for editing
        $scope.changeEditColl = function(coll) {
            $scope.editSelectedColl = coll;
            getSubs();
            filterPopularEditSubs();
        };
        // When a subreddit is added to the edited collection
        $scope.addEditSub = function(sub) {
            $timeout(function() {
                var popDropSel = $('#popularDropdown');
                $scope.addEditSubName = sub.toLowerCase();
                popDropSel.html('Select a subreddit'); // Fix the popular sub list
                // If sub name not empty and not already in sub list
                if($scope.addEditSubName !== '' && jQuery.inArray($scope.addEditSubName,$scope.editSubreddits) == -1) {
                    $scope.editSubreddits.push($scope.addEditSubName); // Add subreddit to collection
                    $scope.addEditSubName = ''; // Clear the field
                    $scope.addEditSubToggle = !$scope.addEditSubToggle; // Blur the field
                    updateEditedCollections();
                    filterPopularEditSubs();
                }
            });
        };
        // When a subreddit is removed from the edited collection
        $scope.removeEditSub = function(sub) {
            $timeout(function() {
                var position = jQuery.inArray(sub,$scope.editSubreddits);
                if(position > -1) { // If in the sub list
                    $scope.editSubreddits.splice(position,1); // Remove subreddit from collection
                    updateEditedCollections();
                    filterPopularEditSubs();
                }
            });
        };
        // When a collection is renamed in the manager
        $scope.renameCollection = function(newName) {
            $scope.renameName = jQuery.trim(newName);
            // If collection name not empty
            if($scope.renameName !== '') {
                $timeout(function() {
                    var renamed = utility.findByProperty($scope.editCollections,'name',$scope.editSelectedColl);
                    renamed.name = $scope.renameName;
                    $scope.editSelectedColl = $scope.renameName;
                    $('#editCollDropdown').html($scope.editSelectedColl); // Fix the edited collection
                    $scope.renameName = ''; // Clear the field
                    $scope.renamingColl = false; // Close the section
                });
            }
        };
        // When a collection is deleted in the manager
        $scope.deleteCollection = function() {
            if($scope.editCollections.length == 1) { return; } // Can't delete if only 1 collection
            var position = -1;
            for(var i = 0; i < $scope.editCollections.length; i++) {
                if($scope.editCollections[i].name == $scope.editSelectedColl) {
                    position = i;
                    edited = true;
                    break;
                }
            }
            if(position > -1) { // If in the collection list
                $scope.editCollections.splice(position,1); // Remove subreddit from collection
                $scope.editSelectedColl = $scope.editCollections[0].name;
                $('#editCollDropdown').html($scope.editSelectedColl); // Fix the edited collection
                getSubs();
            }
        };
        // When a collection is "saved as" in the sidebar
        $scope.addCollection = function(coll) {
            $scope.saveNewName = jQuery.trim(coll);
            // If collection name not empty
            if($scope.saveNewName !== '') {
                var newSubs = [];
                angular.copy($scope.subreddits,newSubs);
                $scope.collections.push({name:$scope.saveNewName,subs:newSubs}); // Add collection
                $scope.selectedColl = $scope.saveNewName;
                storeSubs();
                $('#collDropdown').html($scope.selectedColl); // Fix the edited collection
                $scope.saveNewName = ''; // Clear the field
                $scope.saveAsOpen = false; // Close the section
            }
        };
        // When a collection is cloned
        $scope.cloneCollection = function() {
            var cloneName = 'Copy of ' + $scope.editSelectedColl;
            $scope.editCollections.push({name:cloneName,subs:angular.copy($scope.editSubreddits)}); // Add collection
            $scope.editSelectedColl = cloneName;
            $('#editCollDropdown').html(cloneName); // Fix the edited collection
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
            $timeout(function() { msnry.layout(); }); // Re-layout tiles after css changes take effect
        };
        $scope.addSub = function(sub) {
            $scope.addSubName = sub.toLowerCase();
            // If sub name not empty and not already in sub list
            if($scope.addSubName !== '' && jQuery.inArray($scope.addSubName,$scope.subreddits) == -1) {
                $scope.subreddits.push($scope.addSubName); // Add subreddit to collection
                storeSubs();
                $scope.addSubName = ''; // Clear the field
                $scope.addSubToggle = !$scope.addSubToggle; // Blur the field
                filterPopularSubs();
                clearTiles();
                getTiles();
            }
        };
        $scope.removeSub = function(sub) {
            var position = jQuery.inArray(sub,$scope.subreddits);
            if(position > -1) { // If in the sub list
                $scope.subreddits.splice(position,1); // Remove subreddit from collection
                storeSubs();
                filterPopularSubs();
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
        // Filters out subreddits already in edited collection from the manager popular subs list
        $scope.filterManagerPopular = function(item) {
            return jQuery.inArray(item,$scope.editSubreddits) < 0;
        };
        // Changes which popular subreddit page we're viewing
        $scope.changePopPage = function(dir) {
            $scope.currentPopPage += dir;
            $scope.currentPopPage = $scope.currentPopPage < 0 ? 0 : $scope.currentPopPage;
            $scope.currentPopPage = $scope.currentPopPage >= $scope.totalPopPages ? $scope.totalPopPages-1 : $scope.currentPopPage;
        };
        // When the collections manager is opened
        $scope.openManager = function() {
            $timeout(function() {
                $scope.editSelectedColl = $scope.selectedColl;
                $scope.popularEditSubs = $scope.popularSubs;
                $('#editCollDropdown').html($scope.editSelectedColl); // Fix the edited collection
                $scope.editCollections = JSON.parse(JSON.stringify($scope.collections)); // Deep copy, kill refs
                angular.copy($scope.subreddits,$scope.editSubreddits);
            });
        };
        // When the save changes button is clicked in the collection manager
        $scope.saveChanges = function() {
            $scope.collections = JSON.parse(JSON.stringify($scope.editCollections)); // Deep copy, kill refs
            if(!utility.findByProperty($scope.collections,'name',$scope.selectedColl)) {
                $scope.selectedColl = $scope.collections[0].name;
                $('#collDropdown').html($scope.selectedColl); // Fix the selected collection
            }
            getSubs();
            if(edited) {
                clearTiles();
                getTiles();
            }
            edited = false;
            storeSubs();
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
        // Function run when there are no more results
        var onLastResults = function() {
            noMoreResults = true;
            console.log('no more results!');
            $timeout(function() {
                $scope.loadStatus = 'no more images to load!'; // Tell the user
            });
        };
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
                if(!noMoreResults && $scope.subreddits.length > 0) {
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