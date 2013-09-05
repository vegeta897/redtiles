/* Services */
'use strict';

angular.module('Redtiles.services', [])
    .service('reddit', function($http, $q, parse) {
        var deferred = $q.defer();
        return {
            getPosts: function(subreddits, page) {
                var baseURL = 'http://reddit.com/r/';
                var request = subreddits.join('+');
                var params = {
                    jsonp: 'JSON_CALLBACK',
                    limit: 100
                };
                var results = {};
                $http.jsonp(baseURL+request+'.json', {params: params})
                    .success(function(data) {
                        console.log(data);
                        deferred.resolve(parse.postList(data));
                    }).error(function() {
                        results.error = {name: "Oh no!", description: "It looks like reddit is having problems right now, please try again later."};
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
                    parsed.subreddits = {};
                    for(var i = 0; i < unparsed.data.children.length; i++) {
                        var post = unparsed.data.children[i].data;
                        var isImage = false;

                        if(post.ups/post.downs>2) { post.popular = true; }
                        var size = post.popular ? 'l' : 'b';
                        
                        // TODO: Replace this stuff with regular expressions
                        
                        // Is the URL a jpg, gif, or png?
                        if(post.url.indexOf('.jpg') > 0 || 
                            post.url.indexOf('.gif') > 0 || 
                            post.url.indexOf('.png') > 0) {
                            post.thumbURL = post.url;
                        } else {
                            // Is it an imgur album?
                            if(post.url.indexOf('http://imgur.com/a') == 0) {
                                
                            // Or is it just an imgur page?
                            } else if(post.url.indexOf('http://imgur.com') == 0) {
                                post.thumbURL = 'http://i.imgur.com/' + 
                                    post.url.substr(17,post.url.length) + size + '.jpg';
                                isImage = true;
                            }
                        }
                        // If a non-gif imgur post, use the thumbnail version
                        if(post.url.indexOf('http://i.imgur.com') == 0 && post.url.indexOf('.gif') < 0) {
                            post.thumbURL = post.url.substr(0,post.url.lastIndexOf('.')) + size + 
                                post.url.substr(post.url.lastIndexOf('.'),post.url.length)
                        }
                        // Qualify the image if a thumbnail URL was created
                        if(post.hasOwnProperty('thumbURL')) { 
                            parsed.posts.push(post);
                        } else {
                            
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