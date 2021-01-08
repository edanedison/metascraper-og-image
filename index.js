/* eslint-disable indent */
'use strict';

const { mapSeries } = require('p-iteration');
const probe = require('probe-image-size');
const Url = require('url-parse');

const cleanOpenGraphImages = async ($, url) => {
	const { hostname } = new Url(url);
	const imageList = [];
	const probeTimeout = 2000;
	const minDimensions = { width: 250, height: 250 };
	const acceptableExts = ['jpg', 'png', 'jpeg', 'gif'];
	let resolvedImage = null,
		hasResolved = false;

	try {
		// Scan for all the og:image tags .. there may be multiple in some cases,
		$('meta[property="og:image"]').each((index, element) => {
			imageList.push($(element).attr('content'));
		});

		// Also they may have been given the wrong attribute 'name' as has been found in some cases
		$('meta[name="og:image"]').each((index, element) => {
			imageList.push($(element).attr('content'));
		});

		// Let's check for Twitter too while we're at it
		$('meta[name="twitter:image:src"]').each((index, element) => {
			imageList.push($(element).attr('content'));
		});

		$('meta[name="twitter:image"]').each((index, element) => {
			imageList.push($(element).attr('content'));
		});

		await mapSeries(imageList, async (imageUrl) => {
			// Deal with image references that have not been given a protocol, ie: //media/pic.jpg
			let hasNoProtocol = imageUrl.substring(0, 2) === '//';
			if (hasNoProtocol) {
				imageUrl = `http://${imageUrl.substring(2)}`;
			}
			// Deal with image references that are relative to the server, ie: /pic.jpg
			let isRelative = !imageUrl.includes('//');
			if (isRelative) {
				imageUrl = `http://${hostname}/${imageUrl.substring(2)}`;
			}

			if (hasResolved) return;

			// Probe the images to see if they actually exist and meet the criteria, ie Dimensions, file type
			resolvedImage = await probe(imageUrl, { timeout: probeTimeout })
				.then((image) => {
					const imageType = image.type.toString();
					if (acceptableExts.includes(imageType) && image.width > minDimensions.width) {
						hasResolved = true;
						return image;
					}
				})
				.catch(() => {
					console.debug('Unable to probe image', imageUrl);
				});
		});
		return resolvedImage;
	} catch (err) {
		return null;
	}
};

module.exports = () => {
	const rules = {
		image: [
			async ({ htmlDom: $, url }) => {
				return await cleanOpenGraphImages($, url);
			},
		],
	};
	return rules;
};
