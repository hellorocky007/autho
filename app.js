const express = require("express");
const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose"); 
const session = require('express-session');
const passport = require('passport');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require('lodash');
const { MongoClient } = require('mongodb');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
var GitHubStrategy = require('passport-github2').Strategy;
const findOrCreate = require('mongoose-findorcreate');
// const multer = require("multer");
// const path = require("path");
require('dotenv').config();

const app = express();
const homeStartingContent = "Life is full of challenges and obstacles, but it's how we face and conquer them that defines our journey. In the face of adversity, it's easy to feel overwhelmed, but remember this: every obstacle is an opportunity in disguise. In this blog post, we'll explore stories of individuals who faced adversity head-on, turned their struggles into strengths, and ultimately achieved remarkable success. Let their journeys inspire you on your own path to greatness.";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
const contactContent = "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";
const port = 3000;
const url = "mongodb://localhost:27017"; 
const blogDBName = "blogDB"; 
// Configure middleware
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB setup for both databases (using Mongoose)
mongoose.connect(`${url}/${blogDBName}`);

// Session and Passport setup
app.use(
  session({
    secret: "Rocky secret.",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
// Define Mongoose schemas and models (for both databases)
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
  githubId: String,
  githubUsername: String,
  githubAccessToken: String
});

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// const Media = mongoose.model('Media', mediaSchema);
const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);
passport.use(new GitHubStrategy({
  clientID: process.env.CLIENT_ID1,
  clientSecret:process.env.CLIENT_SECRET1,
  callbackURL: "http://localhost:3000/auth/gihub/rocky",
},
function(accessToken, refreshToken, profile, done) {
  User.findOrCreate({ githubId: profile.id }, function (err, user) {
    return done(err, user);
  });
}
));
// Include route handlers
app.get("/", function (req, res) {
  res.render("login");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/home");
  }
);
app.get('/auth/gihub',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/gihub/rocky', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/home');
  });

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/secrets", async function (req, res) {
  try {
    const foundUsers = await User.find({ "secret": { $ne: null } });
    if (foundUsers) {
      res.render("secrets", { usersWithSecrets: foundUsers });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});
app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    console.log(err);
    res.redirect("/");
  });
});

app.post("/register", function (req, res) {
  const username = req.body.username; 

  if (!username) {
    return res.redirect("/register");
  }
  User.register({ username: username }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      return res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});

//for blogging post
app.get("/home", function (req, res) {
  Post.find()
    .then((posts) => {
      res.render("home", { paragraph: homeStartingContent, newparagraph: posts });
    });

});

app.post("/compose", function (req, res) {
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody
  });

  post.save();
  res.redirect("/home");
});

app.get("/about", function (req, res) {
  res.render("about", { about: aboutContent });
});
app.get("/upload", function (req, res) {
  res.render("upload");
});
app.get("/contact", function (req, res) {
  res.render("contact", { contact: contactContent });
});

app.get("/compose", function (req, res) {
  res.render("compose");
});


app.get("/posts/:postId", function (req, res) {
  const requestPostId = req.params.postId;
  Post.findOne({ _id: requestPostId })
    .then((post) => {
      res.render("post", {
        title: post.title,
        content: post.content
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

