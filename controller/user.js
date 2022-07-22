const { User, Profile, Post, Comment, Tag } = require("../models")
const bcrypt = require('bcryptjs')
const { timeSince } = require("../helper/helper")
const { Op } = require("sequelize")

class Controller {
    static register(req, res) {
        res.render('register')
    }

    static postRegister(req, res) {
        const { fullName, gender, dateOfBirth, userName, email, password } = req.body
        User.create({ userName, email, password })
            .then(user => {
                return Profile.create({ fullName, gender, dateOfBirth, UserId: user.id })
            })
            .then(userProfile => {
                res.redirect(`/`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static login(req, res) {
        if (req.session.userId) {
            return res.redirect("/home")
        }
        res.render('login', { error: req.query.err })
    }

    static postLogin(req, res) {
        const { email, password } = req.body
        const inv = `invalid credentials`
        User.findOne({ where: { email } })
            .then(user => {
                if (user && user.length !== 0) {
                    if (bcrypt.compareSync(password, user.password)) {
                        req.session.userId = user.id;
                        req.session.role = user.role
                        if (req.session.role === false) return res.redirect('/home')
                        else return res.redirect('/admin')
                    } else {
                        return res.redirect(`/?err=${inv}`)
                    }
                } else {
                    return res.redirect(`/?err=${inv}`)
                }
            })
            .catch(err => {
                res.send(err)
            })
    }

    static home(req, res) {
        const search = req.query.search
        const userLogin = req.session.userId
        let param = {
            include: { all: true, nested: true },
            order: [["id", "desc"]],
            where: {}
        }
        if (search) {
            param.where = {
                ...param.where,
                [Op.or]: [
                    {
                        caption: {
                            [Op.iLike]: `%${search}%`
                        }
                    },
                ]
            }
        }

        let post;
        Post.findAll(param)
            .then(result => {
                post = result
                return Post.notification()
            })
            .then(result => {
                const totalPost = result.dataValues.count
                res.render('home', { post, timeSince, totalPost, userLogin })
            })
            .catch(err => {
                console.log(err);
                res.send(err)
            })

    }

    static addPost(req, res) {
        const userLogin = req.session.userId
        Tag.findAll()
            .then(tag => {
                res.render('add-post', { user: req.session.userId, tag, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static postAddPost(req, res) {

        let { TagId, UserId, caption } = req.body
        Post.create({ caption, imageUrl: req.file.path, like: 0, UserId, TagId })
            .then((_) => {
                res.redirect('/home')
            })
            .catch(err => {
                res.send(err)
            })
    }

    static commentSection(req, res) {
        const userLogin = req.session.userId
        const id = +req.params.PostId
        const userId = req.session.userId
        Post.findByPk(id, { include: { all: true, nested: true } })
            .then(post => {
                // res.send(post)
                res.render('post-comment', { post, timeSince, UserId: userId, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static likePost(req, res) {
        const id = +req.params.id

        Post.increment("like", { by: 1, where: { id: id } })
            .then(post => {
                res.redirect(`/comment/${id}`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static unlikePost(req, res) {
        const id = +req.params.id
        Post.findByPk(id)
            .then(post => {
                if (post.like > 0) {
                    return Post.decrement("like", { by: 1, where: { id: id } })
                }
            })
            .then(() => {
                res.redirect(`/comment/${id}`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static profile(req, res) {
        const userLogin = req.session.userId

        const id = +req.params.id;
        User.findByPk(id, { include: { all: true } })
            .then(user => {
                res.render('profile', { user, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static editProfile(req, res) {
        const userLogin = req.session.userId
        Profile.findByPk(+req.params.id, { include: User })
            .then(profile => {
                if (!profile || userLogin !== profile.User.id) {
                    return res.redirect("/home")
                }
                res.render('edit-profile', { profile, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static postProfile(req, res) {
        const userLogin = req.session.userId;

        let { fullName, gender, dateOfBirth, UserId, userName, email } = req.body;
        Profile.update({ fullName, gender, dateOfBirth, UserId }, { where: { id: +req.params.id } })
            .then((_) => {
                return User.update({ userName, email }, { where: { id: +UserId } })
            })
            .then((_) => {
                res.redirect(`/profile/${userLogin}`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static addCommentPostId(req, res) {

        const { PostId, userId } = req.params
        const { comment } = req.body
        Comment.create({ comment, PostId, UserId: userId })
            .then(result => {
                res.redirect(`/comment/${PostId}`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static editPost(req, res) {
        const userLogin = req.session.userId
        const id = +req.params.id
        let tag;
        Tag.findAll()
            .then(tags => {
                tag = tags;
                return Post.findByPk(id)
            })
            .then(post => {
                res.render("editPost", { tag, post, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static postEditPost(req, res) {
        const id = +req.params.id
        const { TagId, UserId, caption } = req.body
        Post.update({ TagId, UserId, caption }, { where: { id: id } })
            .then(result => {
                res.redirect(`/comment/${id}`)
            })
            .catch(err => {
                res.send(err)
            })
    }

    static deletePost(req, res) {
        const postId = +req.params.id
        Post.findByPk(postId)
            .then(post => {
                // res.send(post)
                if (post.UserId !== req.session.userId) {
                    res.redirect("/home")
                } else {
                    return Comment.destroy({ where: { PostId: postId } })
                }
            })
            .then(() => {

                return Post.destroy({ where: { id: postId } })
            })
            .then(() => {
                res.redirect("/home")
            })
            .catch(err => {
                res.send(err)
            })
    }

    static logout(req, res) {
        req.session.destroy((err) => {
            if (err) return res.send(err)
            else return res.redirect('/')
        })
    }

    static admin(req, res) {
        const userLogin = req.session.userId
        if (!req.session.role) {
            return res.redirect("/")
        }
        User.findAll({ include: { all: true } })
            .then(user => {
                res.render("deleteUser", { user, timeSince, userLogin })
            })
            .catch(err => {
                res.send(err)
            })
    }

    static deleteUser(req, res) {
        const id = +req.params.id
        if (!req.session.role) {
            return res.redirect("/")
        }

        User.findByPk(id)
            .then(user => {
                if (!user || user.length === 0) {
                    throw "User not found"
                }
                return Profile.destroy({ where: { UserId: id } })
            })
            .then(result => {
                return Post.destroy({ where: { UserId: id } })
            })
            .then(result => {
                return User.destroy({ where: { id: id } })
            })
            .then(result => {
                res.redirect("/admin")
            })
            .catch(err => {
                res.send(err)
            })
    }

    static deleteComment(req, res) {
        console.log(req.params);
        const { PostId, CommentId } = req.params

        Comment.destroy({ where: { id: CommentId } })
            .then(() => {
                res.redirect(`/comment/${PostId}`)
            })
            .catch(err => {
                res.send(err)
            })
    }
}

module.exports = Controller