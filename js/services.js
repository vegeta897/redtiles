/* Services */
'use strict';
angular.module('Redtiles.services', [])
    .factory('reddit', function($http, $q, parse) {
        return {
            getPosts: function(subreddits, limit, afterID, sort) {
                var deferred = $q.defer();
                var baseURL = 'http://reddit.com/r/';
                var subs = subreddits.join('+') + '/';
                var sorting = '';
                if(jQuery.inArray(sort,['New','Rising','Controversial','Top']) > -1) {
                    sorting = sort.toLowerCase() + '/';
                }
                var params = {
                    jsonp: 'JSON_CALLBACK',
                    limit: limit
                };
                params.after = afterID ? afterID : undefined;
                var results = {};
            //    console.log(baseURL+subs+sorting+'.json'+'?limit='+params.limit+'&jsonp='+params.jsonp+'&after='+params.after);
                $http.jsonp(baseURL+subs+sorting+'.json', {params: params})
                    .success(function(data) {
                        deferred.resolve(parse.postList(data));
                    }).error(function(error) {
                        results.error = {name: "Oh no!", description: "It looks like reddit is having problems right now, please try again later."};
                        console.log('error!',error);
                        // TODO: Error handling/display
                        deferred.reject(results);
                    });
                return deferred.promise;
            }
        }
    })
    .factory('parse', function() {
        return {
            postList: function(unparsed) {
                var parsed = {};
                if(unparsed.hasOwnProperty('data') && unparsed.kind == 'Listing') {
                    parsed.after = unparsed.data.after;
                    parsed.before = unparsed.data.before;
                    parsed.posts = [];
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
                        if(post.hidden) { continue; } // Skip the post if marked as hidden
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
                            // Is it an imgur album/gallery?
                            if(post.url.indexOf('http://imgur.com/a') == 0 || post.url.indexOf('http://imgur.com/gallery') == 0) {
                                // TODO: Album/Gallery stuff here
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
                            parsed.posts.push(post);
                        } else {
                            // No image URL found
                        }
                    }
                } else {
                    parsed.error = {name: "Oh no!", description: "Something's wrong with the reddit service right now. They might be too busy! Try again."};
                }
                return parsed;
            }
        };
    })
    ;