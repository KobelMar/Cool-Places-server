const { default: mongoose } = require("mongoose");
const { validationResult } = require("express-validator");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    //find() provided by Mongoose; Does not return a promise (but can);
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Could not find place with this id", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find a place for the provided id.",
      404
    );

    return next(error);
  }

  // transform mongoose ojbect into js-object; getters to get rid of underscore in id
  place = place.toObject({ getters: true });
  res.json({ place });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let userPlaces = [];

  try {
    //find() provided by Mongoose; Does not return a promise (but can);
    userPlaces = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError(
      "Could not find places for this userId (http Error).",
      500
    );
    return next(error);
  }

  // if (userPlaces.length == 0) {
  //   // the keyword "next" does not cancel the fnct.execution so we need to return.
  //   return next(new HttpError("Could not find places for this user.", 404));
  // }

  userPlaces = userPlaces.map((place) => place.toObject({ getters: true }));

  res.json({ userPlaces });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  console.log(errors);
  if (!errors.isEmpty()) {
    //if function is async you need to "next" errors instead of "throw"
    //we need to return as next is not stoping the execution
    return next(new HttpError("Invalid inputs passed.", 422));
  }

  const { title, description, address } = req.body;
 
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image:
      "https://upload.wikimedia.org/wikipedia/commons/6/62/Neues_Rathaus_und_Marienplatz_M%C3%BCnchen.jpg",
    creator: req.userData.userId
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError("Creating place failed", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find this user.", 404);
    return next(error);
  }

  try {
    //undo all operations if one of these tasks fail in the session
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    // here: this push method is provided by mongoose and only pushed the id
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("Creating place failed.", 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid update-inputs passed.", 422));
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let updatedPlace;
  try {
    //find() provided by Mongoose; Does not return a promise (but can);
    updatedPlace = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Could not update place with this id", 500);
    return next(error);
  }

  if (updatedPlace.creator.toString() !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to update this place.", 401)
    );
  }

  updatedPlace.title = title;
  updatedPlace.description = description;

  try {
    await updatedPlace.save();
  } catch (err) {
    const error = new HttpError("Could not update place with this id", 500);
    return next(error);
  }

  res
    .status(201)
    .json({ updatedPlace: updatedPlace.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let deletedPlace;
  try {
    //find() provided by Mongoose; Does not return a promise (but can);
    //populate() allows us to access document in other collection
    deletedPlace = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError("Could not delete place with this id", 500);
    return next(error);
  }

  if (!deletedPlace) {
    return next(new HttpError("Could not find place with this id", 404));
  }

  if (deletedPlace.creator.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 403)
    );
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await deletedPlace.remove({ session: sess });
    deletedPlace.creator.places.pull(deletedPlace);
    await deletedPlace.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("Could not delete place with this id", 500);
    return next(error);
  }

  res.status(200).json({ message: "Deleted Place." });
};

// all exports will be bundeled into an Object
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
