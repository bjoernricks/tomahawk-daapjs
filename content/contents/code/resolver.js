/*
 * (c) 2013 Julian Xhokaxhiu <http://julianxhokaxhiu.com>
 * (c) 2016 Björn Ricks <bjoern.ricks@gmail.com>
 */
(function(window, Tomahawk, DaapClient) {
'use strict';
var DaapJSResolver = Tomahawk.extend(Tomahawk.Resolver,{
    apiVersion: 0.9,

    ready: false,
    tracks: [],

    settings:
    {
        name: 'DAAP',
        icon: 'daapjs.png',
        weight: 75,
        timeout: 5
    },

    configUi: [
        {
            id: 'host',
            label: 'Host',
            widget: 'serverEdit',
            type: 'textfield',
        },
        {
            id: 'port',
            label: 'Port',
            type: 'textfield',
        },
        {
            id: 'password',
            label: 'Password',
            type: 'textfield',
            isPassword: true,
        }
    ],

    init: function() {
        var userConfig = this.getUserConfig();

        Tomahawk.log('Init DAAP resolver with user config ' +
            JSON.stringify(userConfig));
        //
        this.host = userConfig.host ? userConfig.host : 'localhost';
        this.port = userConfig.port ? userConfig.port : 3689;
        this.password = userConfig.password;

        this.connectToServer();
    },

    getConfigUi: function() {
        var uiData = Tomahawk.readBase64('config.ui');
        return {

            'widget': uiData,
            fields: [
            {
                name: 'host',
                widget: 'serverEdit',
                property: 'text'
            },
            {
                name: 'port',
                widget: 'portEdit',
                property: 'text'
            },
            {
                name: 'password',
                widget: 'passwordEdit',
                property: 'text'
            }
            ],
            images: [{
                'daapjs.png': Tomahawk.readBase64('daapjs.png')
            }]
        };
    },

    newConfigSaved: function(config) {
        var self = this;

        var changed =
            this.host !== config.host ||
            this.port !== config.port ||
            this.password !== config.password;

        if (changed) {

            Tomahawk.log('Config has changed. Trying to connect to server.');

            /* remove already reported tracks */
            var id = daapCollection.settings.id;
            daapCollection.wipe({id: id}).then(function() {
                self.init();
            });
        }
        else {
            Tomahawk.log('Config has not changed.');
            if (!this.ready) {
                /* try to connect again */
                this.connectToServer();
            }
        }
    },

    resolve: function(params) {
        Tomahawk.log('Try to resolve ' + JSON.stringify(params));

        if (!this.ready) {
            return [];
        }

        return this.tracks.filter(function(track) {
            return (track.track === params.track &&
                    track.artist === params.artist &&
                    track.album === params.album);
        });
    },

    search: function(params) {
        var searchString = params.query;

        Tomahawk.log('Searching for ' + searchString);

        if (!this.ready) {
            return [];
        }

        return this.tracks.filter(function(track) {
            return (searchString === '#ALLDAAPDB#' ||
                    song.title.toLowerCase().indexOf(searchString) > -1 ||
                    song.artist.toLowerCase().indexOf(searchString) > -1 ||
                    song.album.toLowerCase().indexOf(searchString) > -1 ||
                    song.genre.toLowerCase().indexOf(searchString) > -1);
        });
    },

    // UTILITY
    connectToServer: function() {
        var self = this;
        var client = new DaapClient(this.host, this.port);
        var loginCompleted = function(code) {
            if (code === 200) {
                Tomahawk.log('Connected. Fetching your song list, it may ' +
                        'take a while...');
                client.fetchStreams(streamsFetched);
            } else if (code == 401) {
                client.secureLogin(self.password, loginCompleted);
            } else {
                Tomahawk.log('Could not login to the DAAP server: ' +
                        '[HTML Status code = ' + code + ']');

            }
        };
        var streamsFetched = function(code, streams) {
            if (code === 200) {

                Tomahawk.log(streams.length + ' tracks fetched.');

                self.tracks = self._convertSongs(streams);
                self.ready = true;

                self._registerTracks();

            }
            else {
                Tomahawk.log('Could not fetch streams: ' +
                        '[HTML Status code = ' + code + ']');
            }
        };
        // start with unsecure login - no password.
        client.login(loginCompleted);
    },

    disconnect: function() {
        if (this.ready) {
            /* remove collection because we shouldn't access it anymore */
            Tomahawk.PluginManager.unregisterPlugin('collection',
                daapCollection);
            this.ready = false;
        }
    },

    _convertSongs: function(songs) {
        songs = songs || [];
        return songs.map(this._convertSong);
    },

    _convertSong: function(song) {
        if (song) {
            return {
                artist: song.artist,
                album: song.album,
                track: song.title,
                url: song.uri,
                bitrate: song.bitrate,
                duration: Math.round(song.duration / 1000),
                size: song.size,
                releaseyear: song.year,
                albumpos: song.trackNumber,
                genre: song.genre,
                extension: song.format,
                daapid: song.id,
            };
        }
    },

    _registerTracks: function() {
        var self = this;
        daapCollection.wipe({
            id: daapCollection.settings.id,
        }).then(function() {
            return daapCollection.addTracks({
                id: daapCollection.settings.id,
                tracks: self.tracks,
            });
        }).then(function() {
            /* register collection after wipe has finished to show the
             * correct number of tracks in Tomahawk */
            Tomahawk.PluginManager.registerPlugin('collection',
                    daapCollection);

        });
    },
});

var daapCollection = Tomahawk.extend(Tomahawk.Collection, {
    resolver: DaapJSResolver,
    settings: {
        id: 'daap',
        prettyname: 'DAAP Library',
        iconfile: 'contents/images/icon.png',
        description: 'A Digital Audio Access Protocol (DAAP) Collection',
    }
});

Tomahawk.resolver.instance = DaapJSResolver;

})(window, Tomahawk, DaapClient);
// vim: set ts=4 sw=4 tw=80:
