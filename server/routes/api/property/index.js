var express = require('express');
var mongoose = require('mongoose');
var path = require('path');
var router = express.Router();
var multer = require('multer');
var crypto = require('crypto');
var grid_fs_storage = require('multer-gridfs-storage');
var grid = require('gridfs-stream');
grid.mongo = mongoose.mongo;
var axios = require('axios');

var Property = require('../../../db/models/Property').Property;
var User = require('../../../db/models/User').User;

// DB Setup
const mongo_uri = 'mongodb://localhost:27017/fyp';

	// Create connection
const conn = mongoose.createConnection(mongo_uri, {
	useNewUrlParser: true
});

let gfs;
conn.once('open', () => {
	gfs = grid(conn.db);
});

var storage = new grid_fs_storage({
	url: 'mongodb://localhost:27017/fyp',
	file: (req, file) => {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(16, (err, buf) => {
				if (err) {
					return reject(err);
				}

				const filename = buf.toString('hex') + path.extname(file.originalname);
				const file_info = {
					filename: filename,
					bucketname: 'uploads'
				};
				resolve(file_info);
			});
		});
	}
});
const upload = multer({ storage });


/* GET property listing. */
router.get('/', function(req, res, next) {
	Property.find((err, docs) => {
		if (err) console.error(err);
		res.json({
			docs: docs
		});
	});
});

/* GET property by id*/
router.get('/:property_id', (req, res, next) => {
	const property_id = req.params.property_id;
	Property.findOne({
		_id: property_id
	}, (err, result) => {
		if (err) console.error(err);
		res.json({
			result: result
		});
	});
});

/* GET property images */
router.get('/:property_id/images/:image_id', (req, res, next) => {
	let imageId = req.params.image_id
	console.log(imageId)
	imageId = new mongoose.Types.ObjectId(imageId)
	gfs.files.findOne({ _id: imageId }, (err, file) => {
		if (err) throw err;

		console.log(file);
		res.contentType(file.contentType);
		res.send(file);
	});
});


/* PUT - update property details */
router.put('/:property_id/update', (req, res, next) => {
	console.log(req.body.listed)
	console.log(req.params.property_id)
	Property.updateOne({
		_id: req.params.property_id
	}, {$set: { listed: req.body.listed }}, (err, result) => {
		res.json({
			result
		});
	});
});

/* POST - create a property */
router.post('/create', upload.array('files'), (req, res, next) => {
	let new_property = JSON.parse(req.body.property);
	console.log(new_property);
	console.log(req.files);
	Property.findOne({
		name: new_property.details.name,
		description: new_property.details.description,
		address: new_property.details.address
	})
	.then(property => {
		if (property) {
			console.log(property);
			handleError("Property with those details already exists", res, next);
		}
		else {
			console.log("Creating a new property");
			new_property.details.images = []
			for (var i in req.files) {
				console.log(req.files[i]);
				new_property.details.images[i] = req.files[i].id;
			}
			console.log(new_property.details.images);
			Property.create(new_property, async (error, result) => {
				if (error) {
					console.log(error);
					res.send(error.name);
				}
				else {
					console.log(result);
					let property_id = result._id;
					User.updateOne({
						_id: result.details.owner
					}, { $push: { 'profiles.seller.properties': property_id }}, (err) => {
						if (err) handleError(err, res, next);
						console.log(`Successfully added property ${result._id} to user ${result.details.owner}`);
						res.json({
							result
						});
					});
				}
			});
		}
	});
});

/* DELETE - delete a property */
router.delete('/delete/:property_id', (req, res, next) => {
	Property.deleteOne({
		_id: req.params.property_id
	}, (err) => {
		if (err) handleError(err, res, next);
		res.send(`Property ${req.params.property_id} was deleted successfully`);
	});
});

// Error handling
function handleError(errorMsg, res, next) {
	const error = new Error(errorMsg);
	next(error);
}

module.exports = router;