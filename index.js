/**
 * @author zuojj
 * @description fis3-deploy-sftp-client
 */

const path = require('path');
const fs = require('fs');
const parents = require('parents');
const async = require('async');
const assign = require('object-assign');
const md5File = require('md5-file');
const Client = require('ssh2');

module.exports = function(options, modifiedFiles, total, callback) {
    new SftpClient(options, modifiedFiles, total, callback);
}

/**
 * [SftpClient Constructor]
 * @param {[type]}   options       [description]
 * @param {[type]}   modifiedFiles [description]
 * @param {[type]}   total         [description]
 * @param {Function} callback      [description]
 */
function SftpClient(options, modifiedFiles, total, callback) {
    options = assign({
        host: "",
        port: 22,
        username: '',
        password: '',
        from: '',
        to: '',
        cache: true
    }, options);

    if (!options.host) {
        throw new Error('options.host is required !');
    } else if (!options.to) {
        throw new Error('options.to is required !');
    } else if (!options.username) {
        throw new Error('options.username is required !');
    }

    this.options = options;
    this.modifiedFiles = modifiedFiles;
    this.cache = {};

    this.uploadedCache();
    this.uploadFiles();
}

/**
 * [print description]
 * @param  {[type]} str [description]
 * @return {[type]}     [description]
 */
function print(str) {
    console.log(' ' + str);
}

/**
 * [now description]
 * @param  {[type]} withoutMilliseconds [description]
 * @return {[type]}                     [description]
 */
function now(withoutMilliseconds) {
    var d = new Date(),
        str;

    str = [
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
    ].join(':').replace(/\b\d\b/g, '0$&');

    if (!withoutMilliseconds) {
        str += '.' + ('00' + d.getMilliseconds()).substr(-3);
    }
    return str;
}



/**
 * [uploadFiles description]
 * @return {[type]} [description]
 */
SftpClient.prototype.uploadFiles = function() {
    var self = this,
        opts = self.options,
        from = opts.from,
        from = from && Array.isArray(from) ? from : [],
        to   = opts.to,
        to   = to && Array.isArray(to) ? to : [],
        cache = self.cache,
        files = self.modifiedFiles,
        filesLen = files.length;

    self.getClient(function(sftp) {
        var fileCount = 0;

        // cache direcotry made 
        cache.mkdir = {};

        async.eachSeries(files, function(file, done) {
            let releasepath = file.getHashRelease(),
                content = file.getContent(),
                realpath = file.realpath,
                subpath = file.subpath,
                topath,
                mkdirArr;

            from.forEach(function(item, index) {
                if(releasepath.indexOf(item) === 0 && to[index]) {
                    topath = path.join(to[index], releasepath).replace(/\\/g, '/')
                }
            });

            if(!topath) {
                done();
                return;
            }

            /* remove root directory */
            mkdirArr = parents(path.dirname(topath).replace(/^\//, '')) || [];
            mkdirArr = mkdirArr.map((item) => {
                item = item.replace(/^\/~/, '~').replace(/\\/g, '/');
                return /^\//.test(item) ? item : ('/' + item);
            }).filter((item) => {
                return !cache.mkdir[item];
            });

            /* teration make directory */
            async.whilst(
                function() {
                    return mkdirArr.length;
                },
                function(next) {
                    let mkdirpath = mkdirArr.pop();

                    // cache tag
                    cache.mkdir[mkdirpath] = true;

                    sftp.mkdir(mkdirpath, {
                        mode: '0755'
                    }, function(err) {
                        next();
                    });
                },
                function() {
                    var fileHash;
                    let time = '[' + now(true) + ']';

                    let _write = function(str) {
                        process.stdout.write(['\n - '.green, time.grey + ' ', subpath.replace(/^\//, ''), ' \u00BB '.green,  str].join(''));
                    }
                    try {
                        fileHash = opts.cache && md5File.sync(realpath);
                        if (fileHash && cache.uploaded[topath] === fileHash) {
                            _write("haven't changed " + (" skipping").yellow);
                            done();
                            return;
                        }
                    }catch(e){}

                    let writeStream = sftp.createWriteStream(topath, {
                        flags: 'w',
                        encoding: null,
                        mode: '0666',
                        autoClose: true
                    });

                    _write(topath);

                    writeStream.on('close', function(err) {
                        if (err) {
                            throw new Error('sftp', err);
                        } else {
                            fileCount++;
                            opts.cache && (cache.uploaded[topath] = fileHash);
                            process.stdout.write(" " + ('\u2714').green.bold);
                        }
                        done();
                    });

                    writeStream.write(content);
                    writeStream.end();
                }
            );
        }, function() {
            print(['\n SFTP:', fileCount, fileCount === 1 ? 'file' : 'files', 'uploaded', 'successfully'].join(' ').green);

            cache.finished = true;

            if(opts.cache) {
                fs.writeFileSync(cache.cacheFilePath, JSON.stringify(cache.uploaded));
                print("Cache file " + cache.cacheFilePath + " updated");
            }

            if (cache.sftp) {
                cache.sftp.end();
            }
            if (cache.client) {
                cache.client.end();
            }
        });
    });
};

/**
 * [getClient description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
SftpClient.prototype.getClient = function(callback) {
    var self = this,
        cache = self.cache,
        opts = self.options;

    let client = new Client();
    cache.client = client;

    client.on('ready', function() {
        client.sftp(function(err, sftp) {
            if (err) {
                throw err;
            }

            sftp.on('end', function() {
                print('SFTP: SESSION CLOSED');
                sftp = null;
                if (!cache.finished) {
                    print('error', new Error("SFTP: ABRUPT CLOSURE"));
                }
            });
            print("\n CLIENT :: CONNECTED");
            cache.sftp = sftp;
            callback(sftp);
        });
    });

    client.on('error', function(err) {
        print('SFTP: ', err);
        reject(err);
    });

    client.on('close', function(hadError) {
        if (!cache.finished) {
            print('SFTP: ABRUPT CLOSURE');
        }
        print('CLIENT :: CLOSED', hadError ? "with error" : "");
    });

    // connect
    client.connect({
        host: opts.host,
        port: opts.port || 22,
        username: opts.username,
        password: opts.password,
        readyTimeout: opts.timeout || 2000
    });
};

/**
 * [uploadedCache description]
 * @return {[type]} [description]
 */
SftpClient.prototype.uploadedCache = function() {
    let self = this,
        opts = self.options,
        cache = self.cache,
        cacheFilePath;

    if(!opts.cache) return;

    cache.uploaded = {};
    cacheFilePath = cache.cacheFilePath = path.join(process.cwd(), 'sftp-uploaded-cache.json');

    try {
        cache.uploaded = require(cacheFilePath) || {};
    }catch(e){
        // console.log(" Cache file:", cacheFilePath, "doesn't exist");
    }
}