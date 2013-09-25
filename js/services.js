/* Services */
'use strict';
angular.module('Redtiles.services', [])
    .factory('reddit', function($http, $q, parse) {
        var phpEndpoint = './php/endpoint.php';
        return {
            // Get posts via jsonp, when user is not logged in
            getPosts: function(subreddits, sort, limit, afterID, logged) {
                var deferred = $q.defer();
                var requestCode = subreddits+'-'+sort+'-'+limit+'-'+afterID+logged; // Caching by this code
                var cached = parse.getCache(requestCode); // Try to get cache for this request, clean out expired
                // If non-expired cache found for this requestCode, return it
                if(cached) { console.log('found cached results'); deferred.resolve(cached); return deferred.promise; } 
                // Proceeding if no non-expired cache was found
                var sorting = logged ? 'best' : '';
                if(jQuery.inArray(sort,['New','Rising','Controversial','Top']) > -1) {
                    sorting = sort.toLowerCase() + '/';
                }
                var params = {
                    limit: limit
                };
                params.after = afterID ? afterID : undefined;
                var results = {};
                if(logged) { // Logged in, post list request with modhash
                    params.action = 'getListing';
                    params.sr = subreddits.join('+');
                    params.sort = sorting;
                    $http({method: 'GET', url: phpEndpoint, params: params})
                        .success(function (data) {
                            var returnData = parse.postList(data);
                            if(returnData.hasOwnProperty('posts')) { // If the result contains posts
                                parse.storeCache(requestCode, returnData); // Cache the results
                            }
                            deferred.resolve(returnData);
                        });
                } else { // Not logged in, basic post list request
                    var baseURL = 'http://reddit.com/r/';
                    var subs = subreddits.join('+') + '/';
                    params.jsonp = 'JSON_CALLBACK';
                    $http.jsonp(baseURL+subs+sorting+'.json', {params: params})
                        .success(function(data) {
                            var returnData = parse.postList(data);
                            if(returnData.hasOwnProperty('posts')) { // If the result contains posts
                                parse.storeCache(requestCode, returnData); // Cache the results
                            }
                            deferred.resolve(returnData);
                        }).error(function(data, status, headers, config) {
                            results.error = {name: "Oh no!", description: "No response from reddit"};
                            console.log('error!', data, status, headers, config);
                            deferred.reject(results);
                        });
                }
                return deferred.promise;
            },
            generic: function(params) {
                var deferred = $q.defer();
                $http({method: 'GET', url: phpEndpoint, params: params})
                    .success(function (data) {
                        deferred.resolve(data);
                    });
                return deferred.promise;
            },
            imgAjax: function(url) {
                var deferred = $q.defer();
                var params = {
                    action: 'imgAjax',
                    url: url
                };
                $http({method: 'GET', url: phpEndpoint, params: params})
                    .success(function (data) {
                        deferred.resolve(data);
                    });
                return deferred.promise;
            }
        }
    })
    .factory('parse', function(localStorageService) {
        return {
            postList: function(unparsed) {
                var parsed = {}; // Empty object for the parsed results
                // List of properties we're going to delete from each post because we don't need them
                var unusedProperties = ['banned_by','media_embed','selftext_html','selftext','secure_media','secure_media_embed','clicked','stickied','media','approved_by','thumbnail','subreddit_id','edited','link_flair_css_class','is_self','created','author_flair_text','link_flair_text','num_comments','num_reports','distinguished'];
                if(unparsed == '""') { unparsed = {};}
                if(!unparsed.hasOwnProperty('data') || unparsed.kind != 'Listing') {
                    parsed = unparsed;
                    parsed.error = {name: "Oh no!", description: "No response from reddit"};
                    return parsed;
                }
                parsed.after = unparsed.data.after;
                parsed.before = unparsed.data.before;
                parsed.posts = []; // Empty array property for the list of parsed posts
                var voteRatios = []; // Array of upvote/downvote ratios
                // Populate the voteRatios array
                for(var j = 0; j < unparsed.data.children.length; j++) {
                    var prePost = unparsed.data.children[j].data;
                    voteRatios.push(prePost.ups/(prePost.downs+1));
                }
                // Sort the ratios in ascending order
                voteRatios.sort(function(a,b) { return a - b; });
                // Set minimum popularity to the top 25%
                var minPopularity = voteRatios[Math.floor(voteRatios.length*0.75)];
                // Set minimum super popularity to the top 3%
                var minSuperPopularity = voteRatios[Math.floor(voteRatios.length*0.97)];
                // Main parsing loop
                for(var i = 0; i < unparsed.data.children.length; i++) {
                    var post = unparsed.data.children[i].data;
                    if(post['hidden']) { continue; } // Skip the post if marked as hidden
                    if(post.likes === true) {
                        post.voted = 1;
                    } else if(post.likes === false) {
                        post.voted = -1;
                    }
                    // If a post has more than the minimum popularity, tag it popular
                    if(post.ups/(post.downs+1)>minPopularity) { post.popular = true; }
                    if(post.ups/(post.downs+1)>minSuperPopularity) { post.superPopular = true; }
                    var size = 'l'; // Imgur sizing suffix
                    
                    // TODO: Replace this stuff with regular expressions
                    
                    // Is the URL a jpg, gif, or png?
                    if(post.url.indexOf('.jpg') > 0 ||
                        post.url.indexOf('.jpeg') > 0 ||
                        post.url.indexOf('.gif') > 0 || 
                        post.url.indexOf('.png') > 0) {
                        post.thumbURL = post.url;
                        post.fixedURL = post.url;
                    } else {
                        // Is it an imgur album?
                        if(post.url.indexOf('http://imgur.com/a/') == 0) {
                            console.log('album found!');
                            post.thumbURL = 'http://api.imgur.com/2/album/' + post.url.substring(19,post.url.length);
                            post['ajax'] = true; // The image will have to be acquired later
                        // Is it an imgur gallery?
                        } else if(post.url.indexOf('http://imgur.com/gallery') == 0) {
                            console.log('gallery found!');
                            post.thumbURL = post.url;
                            post['ajax'] = true; // The image will have to be acquired later
                        // Or is it just an imgur page?
                        } else if(post.url.indexOf('http://imgur.com') == 0) {
                            // Is it a list of image IDs?
                            if(post.url.indexOf(',') >= 17) {
                                post.thumbURL = 'http://i.imgur.com/' +
                                    post.url.substring(17,post.url.indexOf(',')) + size + '.jpg';
                                post.fixedURL = 'http://i.imgur.com/' +
                                    post.url.substring(17,post.url.indexOf(',')) + '.jpg';
                            } else {
                                post.thumbURL = 'http://i.imgur.com/' +
                                    post.url.substring(17,post.url.length) + size + '.jpg';
                                post.fixedURL = 'http://i.imgur.com/' +
                                    post.url.substring(17,post.url.length) + '.jpg';
                            }
                            
                        // Is it an i.imgur URL without an extension?
                        } else if(post.url.indexOf('http://i.imgur.com/') == 0) {
                            post.thumbURL = 'http://i.imgur.com/' +
                                post.url.substring(19,post.url.length) + size + '.jpg';
                            post.fixedURL = 'http://i.imgur.com/' +
                                post.url.substring(19,post.url.length) + '.jpg';
                        }
                    }
                    // If a gif imgur post, use the thumbnail version
                    if(post.url.indexOf('http://i.imgur.com') == 0 && post.url.indexOf('.gif') < 0) {
                        post.thumbURL = post.url.substr(0,post.url.lastIndexOf('.')) + size + 
                            post.url.substring(post.url.lastIndexOf('.'),post.url.length)
                    }
                    // Qualify the image if a thumbnail URL was created
                    if(post.hasOwnProperty('thumbURL')) { 
                        for(var k = 0; k < unusedProperties.length; k++) { // Iterate through unused property names
                            delete post[unusedProperties[k]]; // Delete each property from the post
                        }
                        parsed.posts.push(post); // Push the post into the parsed posts array
                    }
                }
                return parsed;
            },
            getCache: function(requestCode) {
                var d = new Date(); // Date object for getTime()
                var cacheIndex = localStorageService.get('cacheIndex');
                if(cacheIndex) { // If the cacheIndex exists
                    var cleanCacheIndex = [];
                    for(var i = 0; i < cacheIndex.length; i++) { // Clean out expired caches
                        if(cacheIndex[i]['expires'] < d.getTime()) { // If this entry has expired
                            localStorageService.remove(cacheIndex[i]['requestCode']); // Remove the cached data
                        } else { // If this entry hasn't expired
                            cleanCacheIndex.push(cacheIndex[i]); // Put it in the cleaned index
                        }
                    }
                    localStorageService.set('cacheIndex',cleanCacheIndex); // Put the cleaned index back in storage
                }
                return localStorageService.get(requestCode); // Return cached data (returns falsey if cache not found)
            },
            storeCache: function(requestCode, resultData) {
                var d = new Date(); // Date object for getTime()
                localStorageService.set(requestCode, resultData); // Store it under its requestCode
                var cacheIndex = localStorageService.get('cacheIndex');
                if(!cacheIndex) { cacheIndex = []; } // If the cacheIndex doesn't exist, initialize it
                // Add the cache entry to the index
                cacheIndex.push({requestCode: requestCode, expires: d.getTime() + 120000}); // Expires 120s from now
                localStorageService.set('cacheIndex',cacheIndex); // Put the index back in storage
            }
        };
    })
    .factory('utility', function() { // Utility containing various helper functions
        return {
            objToArray: function(obj) { // Convert an object's properties into an array of objects
                var arr = [];
                for(var key in obj) {
                    if(obj.hasOwnProperty(key)) {
                        arr.push({name:key,value:obj[key]});
                    }
                }
                return arr;
            },
            sortArrayByProperty: function(arr, sortby, descending) {
                if(arr[0].hasOwnProperty(sortby)) {
                    if(descending) {
                        arr.sort(function(obj1, obj2) {return obj2[sortby] - obj1[sortby]})
                    } else {
                        arr.sort(function(obj1, obj2) {return obj1[sortby] - obj2[sortby]})
                    }
                }
                return arr;
            },
            findByProperty: function(array, propName, propValue){ // Look through an array for an object with this property/value pair
                return jQuery.grep(array, function(item) {
                    return item[propName] == propValue;
                })[0]; // Return the item itself instead of a single-item array
            },
            removeByProperty: function(array, propName, propValue){ // Return an array after removing the object with this property/value pair
                return jQuery.grep(array, function(item) {
                    return item[propName] != propValue;
                })
            }
        };
    })
    ;