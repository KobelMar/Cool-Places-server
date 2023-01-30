const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

const HttpError = require("../models/http-error");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(new HttpError("Could not retrieve users", 500));
  }
  users = users.map((user) => user.toObject({ getters: true }));
  res.json({ users });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new HttpError("Provided Sign-up data invalid.", 422));
  }

  const { name, email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Sign-up failed", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError("email exist already", 422);
    return next(error);
  }

  let hashedPassword;

  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch {
    const error = new HttpError("Could not create User (Http error).", 500);
    return next(error);
  }

  const createdUser = new User({
    name,
    email,
    image:
      "https://upload.wikimedia.org/wikipedia/en/1/12/Chewbaca_%28Peter_Mayhew%29.png",
    password: hashedPassword,
    places: [],
  });

  try {
    // save() is available by Mongoose, is a Promise and will add _id.
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Sign up failed.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch {
    const error = new HttpError("Sign up failedd.", 500);
    return next(error);
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let identifiedUser;
  try {
    identifiedUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Login failed (Http error).", 500);
    return next(error);
  }

  if (!identifiedUser) {
    const error = new HttpError("invalid credentials, couldn't login", 401);
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, identifiedUser.password);
  } catch {
    const error = new HttpError("Could not Login User (Http error).", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError("invalid credentials, couldn't login", 401);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: identifiedUser.id, email: identifiedUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch {
    const error = new HttpError("Login failed.", 500);
    return next(error);
  }


  res.json({
    userId: identifiedUser.id,
    email: identifiedUser.email,
    token 
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
