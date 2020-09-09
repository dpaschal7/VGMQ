var express = require('express');
var router = express.Router();
var createError = require('http-errors');

var usersdb = require('../private/usersdb');

var matchmaking = require('../private/matchmaking');

/* GET create lobby */
async function getCreateLobby(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);
    }
    catch (err)
    {
        // Go to log in if not logged in
        res.redirect('/');
        return;
    }

    // If the user is already in a lobby, we should redirect them there right away
    try
    {
        matchmaking.getLobbyWithPlayer(req.session.username);
        res.redirect('/lobby/ingame');
        return;
    }
    catch (err) {}

    var content = {};
    if (req.query.err)
        content.errortext = decodeURIComponent(req.query.err);
    
    res.render('createlobby', content);
}
router.get('/create', getCreateLobby);

/* POST create lobby */
async function postCreateLobby(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);

        // Prune inactive lobbies
        matchmaking.prune();

        // Create a lobby with this user in it
        // Also starts the lobby state machine
        await matchmaking.createLobbyWithPlayer(req.body.name, req.body.password, req.session.username);

        // Go to game
        res.redirect('/lobby/ingame');
    }
    catch (err)
    {
        var string = encodeURIComponent(err);
        res.redirect('/lobby/create?err=' + err);
    }
}
router.post('/create', postCreateLobby);

/* GET join lobby */
async function getJoinLobby(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);
    }
    catch (err)
    {
        // Go to log in if not logged in
        res.redirect('/');
        return;
    }

    // If the user is already in a lobby, we should redirect them there right away
    try
    {
        matchmaking.getLobbyWithPlayer(req.session.username);
        res.redirect('/lobby/ingame');
        return;
    }
    catch (err) {}

    // Prune inactive lobbies
    matchmaking.prune();

    var content =
    {
        lobbies: matchmaking.lobbies
    };

    if (req.query.err)
        content.errortext = decodeURIComponent(req.query.err);
    
    res.render('joinlobby', content);
}
router.get('/join', getJoinLobby);

/* POST join lobby */
async function postJoinLobby(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);

        // Find a lobby with the given name
        var lobby = matchmaking.getLobbyWithName(req.body.name);

        // Verify password
        if (lobby.password != '' && req.body.password != lobby.password)
        {
            throw 'Incorrect lobby password.'
        }

        // Add this player to the lobby
        lobby.addPlayer(req.session.username);

        // Go to the game
        res.redirect('/lobby/ingame');
    }
    catch (err)
    {
        var string = encodeURIComponent(err);
        res.redirect('/lobby/join?err=' + err);
    }
}
router.post('/join', postJoinLobby);

/* GET in-game */
async function getInGame(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);
    }
    catch (err)
    {
        // Go to log in if not logged in
        res.redirect('/');
        return;
    }

    try
    {
        // Get the lobby with this player
        var lobby = matchmaking.getLobbyWithPlayer(req.session.username);

        // Show the in-game screen
        var content =
        {
            username: req.session.username,
            lobby: lobby
        };
        res.render('ingame', content);
    }
    catch (err)
    {
        // Failed to get in the lobby
        res.redirect('/main');
    }
}
router.get('/ingame', getInGame);

/* POST game settings */
async function postSettings(req, res, next)
{
    try
    {
        await usersdb.auth(req.session.username, req.session.password);

        // Find the lobby that has this user as host
        var lobby = matchmaking.getLobbyWithPlayer(req.session.username, true);

        // Update the lobby settings
        lobby.settings = req.body;

        // Notify clients
        lobby.sendLobbyInfo();

        // Go to the game
        res.status(200).send('OK');
    }
    catch (err)
    {
        // Failed
        console.log(err);
        res.status(304).send('Not Modified');
    }
}
router.post('/settings', postSettings);

module.exports = router;
