# chunked-vox

[![NPM version badge](https://img.shields.io/npm/v/chunked-vox.svg)](http://npmjs.com/package/chunked-vox)
[![Open GitHub issues badge](https://img.shields.io/github/issues/bunnynabbit/chunked-vox)](https://github.com/BunnyNabbit/chunked-vox/issues)
[![Test status badge](https://github.com/BunnyNabbit/chunked-vox/actions/workflows/ci.yml/badge.svg)](https://github.com/BunnyNabbit/chunked-vox/actions/workflows/ci.yml)

Writes large voxel models in Magicavoxel format
```js
const { VoxelModelWriter } = require("chunked-vox")
const fs = require("fs")

function generateGrayscalePalette() {
	const palette = []
	for (let index = 0; index < 256; index++) {
		palette.push([index, index, index]) // RGB
	}
	return palette
}

const voxelModel = new VoxelModelWriter(generateGrayscalePalette())

// generate random model
function randomIntFromInterval(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min)
}

const modelSize = 368
for (let x = 0; x < modelSize; x++) {
	for (let y = 0; y < modelSize; y++) {
		voxelModel.setBlock(x, y, 0, randomIntFromInterval(0, 255))
	}
}

// write file
const buffer = voxelModel.writeVox()
fs.writeFileSync("./test.vox", buffer)
console.log(`wrote ${buffer.length} bytes`)
```
