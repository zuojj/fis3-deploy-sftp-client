
/**
 * @author zuojj
 * @description fis3-deploy-sftp-client
 */


const path = require('path');
const fs   = require('fs');
const Client = require('ssh2');
const async = require('async');
const assign = require('object-assign');
const md5File = require('md5-file');



module.exports = function (options, modifiedFiles, total, callback) {
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
        excludePattern: null,
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
    this.uploadFiles();
}

/**
 * [print description]
 * @param  {[type]} str [description]
 * @return {[type]}     [description]
 */
function print(str) {
    console.log(str);
}

/**
 * [uploadFiles description]
 * @return {[type]} [description]
 */
SftpClient.prototype.uploadFiles = function () {
    var self = this,
        opts = self.options,
        cache = self.cache,
        files = self.modifiedFiles;

    self.getClient(function (sftp) {
        var fileCount = 0;

        async.eachSeries(files, function (file, done) {
            let releasePath = file.getHashRelease(),
                content  = file.getContent(),
                realpath = file.realpath,
                subpath  = file.subpath,
                topath   = path.join(opts.to, release);

            async.whilst(function () {
                return true;
            }, function (next) {
                sftp.mkdir(path.dirname(topath), { mode: '0755' }, function () {
                    process.stdout.write(" " + '\u2714'.green);
                    next();
                });
            }, function () {
                let readStream = fs.createReadStream(realpath);
                let writeStream = sftp.createWriteStream(topath, {
                    flags: 'w',
                    encoding: null,
                    mode: '0666',
                    autoClose: true
                });

                let time = '[' + fis.log.now(true) + ']';

                process.stdout.write(
                    '\n - '.green.bold +
                    time.grey + ' ' +
                    subpath.replace(/^\//, '') +
                    ' >> '.yellow.bold +
                    topath
                );

                readStream.pipe(writeStream);
                writeStream.on('close', function (err) {
                    if (err) {
                        throw new Error('sftp', err);
                    } else {
                        fileCount ++ ;
                        process.stdout.write(" " + ('\u2714').green);
                    }
                    done();
                });
            });
        }, function () {
            print('\nsftp:', (fileCount, fileCount === 1 ? 'file' : 'files', 'uploaded successfully').green);

            cache.finished = true;

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
SftpClient.prototype.getClient = function (callback) {
    var self = this,
        cache = self.cache;

    print('Authenticating with password.');

    let client = new Client();
    cache.client = client;

    client.on('ready', function () {
        client.sftp(function (err, sftp) {
            if (err) {
                throw err;
            }

            sftp.on('end', function () {
                print('SFTP session closed');
                sftp = null;
                if (!finished) {
                    print('error', new Error('sftp', "SFTP abrupt closure"));
                }
            });

            cache.sftp = sftp;
            print("Connected");
            callback(sftp);
        });
    });

    client.on('error', function (err) {
        print('sftp', err);
        reject(err);
    });

    client.on('close', function (hadError) {
        if (!cache.finished) {
            print('sftp', "SFTP abrupt closure");
        }
        print('Connection :: close', hadError ? "with error" : "");
    });

    // connect
    client.connect({
        host: options.host,
        port: options.port || 22,
        username: options.username,
        password: options.password,
        readyTimeout: options.timeout || 2000
    });
}

