const express = require("express");
const router = express.Router();
const { Users, UserGameHistory, UserGameBiodata } = require("../models");
const { isLoggedIn, isLoggedInAsAdmin } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const res = require("express/lib/response");
const { v4: uuidv4 } = require("uuid");

router.get("/", (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    jwt.verify(token, "secret", (err, decodedToken) => {
      if (err) {
        res.render("index", {
          pageTitle: "Traditional Games",
          id: "",
          user: "",
          role_id: "",
        });
      } else {
        res.render("index", {
          pageTitle: "Traditional Games",
          id: decodedToken.id,
          user: decodedToken.username,
          role_id: decodedToken.role_id,
        });
      }
    });
  } else {
    res.render("index", {
      pageTitle: "Traditional Games",
      id: "",
      user: "",
      role_id: "",
    });
  }
});

router.get("/login", (req, res) => {
  const status = req.query.status;
  if (!status) {
    res.render("login", { pageTitle: "Login", loginMessage: "Welcome, please login to start the game" });
  } else {
    if (status == "usernamenotfound") {
      res.render("login", { pageTitle: "Login", loginMessage: "Username not found, please input the correct username" });
    } else {
      if (status == "wrongpassword") {
        res.render("login", { pageTitle: "Login", loginMessage: "Wrong password, please input the correct password" });
      } else {
        if (status == "successlogout") {
          res.render("login", { pageTitle: "Login", loginMessage: "Success logout" });
        } else {
          if (status == "tokenexpied") {
            res.render("login", { pageTitle: "Login", loginMessage: "Your session has expied, please login to start the game" });
          } else {
            if (status == "signupsuccess") {
              res.render("login", { pageTitle: "Login", loginMessage: "Your account has been created successfully, please login to start the game" });
            } else {
              res.render("login", { pageTitle: "Login", loginMessage: "You are not logged in, please login to start the game" });
            }
          }
        }
      }
    }
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const userMatch = await Users.findAll({
    where: {
      username: username,
    },
  });

  if (userMatch.length == 0) {
    res.redirect("/login?status=usernamenotfound");
  } else {
    const passwordVerify = bcrypt.compareSync(password, userMatch[0].password);
    if (passwordVerify == true) {
      const token = jwt.sign(
        {
          id: userMatch[0].uuid,
          username: userMatch[0].username,
          role_id: userMatch[0].role_id,
        },
        "secret",
        { expiresIn: 60 * 60 * 24 } //satuan detik, bawaan jsonwebtoken
      );
      res.cookie("jwt", token, { maxAge: 1000 * 60 * 60 * 24 }); //satuan milisekon, bawaan cookie-parser
      if (userMatch[0].role_id == 2) {
        // res.redirect("/game/" + userMatch[0].uuid);
        res.redirect("/game");
      } else {
        res.redirect("/dashboard");
      }
    } else {
      res.redirect("/login?status=wrongpassword");
    }
  }
});

router.get("/logout", (req, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.redirect("/login?status=successlogout");
});

router.get("/signup", (req, res) => {
  const status = req.query.status;
  if (!status) {
    res.render("signup", { pageTitle: "Sign Up", loginMessage: "" });
  } else {
    if (status == "usernamealreadyexist") {
      res.render("signup", { pageTitle: "Sign Up", loginMessage: "The username you entered is already registered, please enter a new username" });
    } else {
      if (status == "passwordnotmatch") {
        res.render("signup", { pageTitle: "Sign Up", loginMessage: "Password you entered is not match, please try again" });
      } else {
        res.render("login", { pageTitle: "Login", loginMessage: "Your account has been created successfully" });
      }
    }
  }
});

router.post("/signup", async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  const userMatch = await Users.findAll({
    where: {
      username: username,
    },
  });

  if (userMatch.length > 0) {
    res.redirect("/signup?status=usernamealreadyexist");
  } else {
    if (password != confirmPassword) {
      res.redirect("/signup?status=passwordnotmatch");
    } else {
      const salt = bcrypt.genSaltSync(16);
      const passwordHash = bcrypt.hashSync(password, salt);
      const id = uuidv4();
      const newUserGame = await Users.create({
        uuid: id,
        username,
        password: passwordHash,
      });
      const newUserGameBiodata = await UserGameBiodata.create({
        user_game_id: id,
      });
      res.redirect("/login?status=signupsuccess");
    }
  }
});

router.get("/profile/:id", isLoggedIn, async (req, res, next) => {
  try {
    const status = req.query.status;
    user_game_id = req.params.id;
    console.log(user_game_id);
    const userBiodata = await UserGameBiodata.findOne({
      where: {
        user_game_id: user_game_id,
      },
    });
    if (!status) {
      res.render("profile", {
        pageTitle: "Profile",
        data: userBiodata,
        loginMessage: "",
      });
    } else {
      res.render("profile", {
        pageTitle: "Profile",
        data: userBiodata,
        loginMessage: "Success update your biodata!",
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post("/profile/:id", isLoggedIn, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullname, email, birthday, nationality } = req.body;
    const userBiodataToUpdate = await UserGameBiodata.findOne({
      where: {
        user_game_id: id,
      },
    });
    if (userBiodataToUpdate) {
      const updated = await userBiodataToUpdate.update({
        // kalau name dari body ada pakai name dari body, kalau tidak pakai name yang sebelumnya sudah ada di db
        fullname: fullname ?? userBiodataToUpdate.fullname,
        email: email ?? userBiodataToUpdate.email,
        birthday: birthday ?? userBiodataToUpdate.birthday,
        nationality: nationality ?? userBiodataToUpdate.nationality,
      });
      res.redirect(`/profile/${id}?status=successupdateprofile`);
    } else {
      res.status(404).json({
        message: "user not found",
      });
    }
  } catch (err) {
    next(err);
  }
});

router.get("/game", isLoggedIn, (req, res) => {
  res.render("game", { pageTitle: "Rock Paper Scissors" });
});

router.get("/dashboard", isLoggedInAsAdmin, async (req, res) => {
  const userList = await Users.findAll({
    include: "user_game_biodata",
    where: {
      role_id: 2,
    },
  });
  const status = req.query.status;
  if (!status) {
    res.render("dashboard", {
      pageTitle: "Dashboard",
      data: userList,
      loginMessage: "",
    });
  } else {
    res.render("dashboard", {
      pageTitle: "Dashboard",
      data: userList,
      loginMessage: "Success delete user",
    });
  }
});

router.get("/dashboardDelete/:id", isLoggedInAsAdmin, async (req, res, next) => {
  try {
    const userToDelete = await Users.findByPk(req.params.id);
    // jika user yang akan di edit ditemukan
    if (userToDelete) {
      // delete anaknya dulu baru ortunya
      await UserGameHistory.destroy({
        where: { user_game_id: req.params.id },
      });
      await UserGameBiodata.destroy({
        where: { user_game_id: req.params.id },
      });
      // bentuk sql nya  DELETE FROM "users" WHERE "uuid" = '29b37eb8-8509-498e-837d-db57d8ee2617'
      const deleted = await Users.destroy({
        where: {
          uuid: req.params.id,
        },
      });
      // kalau deleted nya sama dengan angka 1 berarti berhasil
      // kalau deleted nya sama dengan angka 1 berarti berhasil
      res.redirect(`/dashboard?status=successdeleteuser`);
    } else {
      res.status(404).json({
        message: "user not found",
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/statistic/:id", isLoggedInAsAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const username = await Users.findOne({
      where: {
        uuid: id,
      },
    });
    const userWin = await UserGameHistory.count({ col: "result", where: { result: "win" } });
    const userDraw = await UserGameHistory.count({ col: "result", where: { result: "draw" } });
    const userLose = await UserGameHistory.count({ col: "result", where: { result: "lose" } });
    const userGameHistory = await UserGameHistory.findAll({
      include: ["user_game"],
      where: {
        user_game_id: id,
      },
    });
    const status = req.query.status;
    if (!status) {
      res.render("userStatistic", {
        pageTitle: "User Statistic",
        data: userGameHistory,
        username: username.username,
        userMatch: {
          userWin,
          userDraw,
          userLose,
        },
        loginMessage: "",
      });
    } else {
      res.render("userStatistic", {
        pageTitle: "User Statistic",
        data: userGameHistory,
        username: username.username,
        userMatch: {
          userWin,
          userDraw,
          userLose,
        },
        loginMessage: "Success delete your history",
      });
    }
  } catch (err) {
    next(err);
  }
});

router.get("/statisticDelete/:id", isLoggedInAsAdmin, async (req, res, next) => {
  try {
    const userGameHistory = await UserGameHistory.findByPk(req.params.id);
    // jika user yang akan di edit ditemukan
    const id = userGameHistory.user_game_id;
    if (userGameHistory) {
      const deleted = await UserGameHistory.destroy({
        where: {
          uuid: req.params.id,
        },
      });
      // kalau deleted nya sama dengan angka 1 berarti berhasil
      res.redirect(`/statistic/${id}?status=successdeletehistory`);
    }
  } catch (err) {
    next(err);
  }
});

router.post("/api/user_game_history", async (req, res, next) => {
  const { user_game_id, playerChoose, comChoose, result } = req.body;
  const newGameHistory = await UserGameHistory.create({
    user_game_id,
    playerChoose,
    comChoose,
    result,
  });
  if (newGameHistory) {
    res.status(201).json({
      message: "SUCCESS",
      data: newGameHistory,
    });
  } else {
    res.status(400).json({
      message: "FAILED",
    });
  }
});

module.exports = router;
