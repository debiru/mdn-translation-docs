# mdn-translation-docs

- https://mdn.lavoscore.org/

## Initialization

```
$ cd .repo

$ git clone git@github.com:mdn/content.git
$ git clone git@github.com:mdn/translated-content.git
$ git clone git@github.com:mdn/interactive-examples.git

$ cd ..
```

```
$ cd .core

$ ./composer.phar install

$ cd ..
```

## Generate all.json

```
$ ./.core/generateAllJson.sh
```
