# fis3-deploy-sftp-client

[![Latest NPM release][npm-badge]][npm-badge-url]

[npm-badge]: https://img.shields.io/npm/v/fis3-deploy-sftp-client.svg
[npm-badge-url]: https://www.npmjs.com/package/fis3-deploy-sftp-client



It is a deploy files tool from sftp client based on ssh2


## Defaults

```javascript
{
    host: "",
    port: 22,
    username: '',
    password: '',
    /* filter by fis release path  */
    from: '',
    /* remote linux path */
    to: '',
    cache: true
}
```

## Install

```shell
npm install [-g] fis3-deploy-sftp-client
```

## use

```javascript
fis.match('*', {
    deploy: fis.plugin('sftp-client', {
        from: ['/resource/static', '/view'],
        to: ['/test2/a', '/test2/b'],
        host: '10.134.xx.xxx',
        username: 'root',
        password: 'xxx3'
    })
})
```
