<?php
session_save_path('/home/users/web/b1197/ipg.isotownnet/cgi-bin/tmp');
require_once("reddit.php");

function login($user,$pass)
{
    $reddit = new reddit();
    $login_info = $reddit->login($user,$pass);
    session_start();
    $_SESSION['reddit'] = $reddit;
    if(is_array($login_info)) {
        session_write_close();
        return (object)array("session" => $login_info);
    }
    $user_info = $reddit->getUser();
    session_write_close();
    return (object)array("session" => $login_info, "userInfo" => $user_info);
}

function autoLogin($modhash,$cookie)
{
    $reddit = new reddit();
    $reddit->resume($modhash,$cookie);
    $user_info = $reddit->getUser();
    session_start();
    $_SESSION['reddit'] = $reddit;
    session_write_close();
    return $user_info;
}

function logout()
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        return 'User must be logged in';
    }
    unset($_SESSION['reddit']);
    session_regenerate_id(true);
    unset($reddit);

    return 'Logged out';
}

function getListing($sr, $sort, $limit, $after = null)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        return $_SESSION['reddit'];
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->getListing($sr, $sort, $limit, $after);
    if(empty($response)) { $response = ""; }
    session_write_close();
    return $response;
}

function cast_vote($id,$dir)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        session_write_close();
        return 'User must be logged in';
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->addVote($id,$dir);
    session_write_close();
    return $response;
}

function fave($id)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        session_write_close();
        return 'User must be logged in';
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->savePost($id);
    session_write_close();
    return $response;
}

function unfave($id)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        session_write_close();
        return 'User must be logged in';
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->unsavePost($id);
    session_write_close();
    return $response;
}

function hide($id)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        session_write_close();
        return 'User must be logged in';
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->hidePost($id);
    session_write_close();
    return $response;
}

function imgAjax($url)
{
    $ch = curl_init();
    $options = array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_USERAGENT => 'Redtiles web-app 1.0 by /u/vegeta897',
        CURLOPT_URL => $url . '.json'
    );
    curl_setopt_array($ch, $options);
    $response = json_decode(curl_exec($ch));
    curl_close($ch);
    return $response;
}

$value = "MissingParams";

if (isset($_GET["action"]))
{
    switch ($_GET["action"])
    {
        case "cast_vote":
            if (isset($_GET["id"],$_GET["dir"]))
                $value = cast_vote($_GET["id"],$_GET["dir"]);
            break;
        case "fave":
            if (isset($_GET["id"]))
                $value = fave($_GET["id"]);
            break;
        case "unfave":
            if (isset($_GET["id"]))
                $value = unfave($_GET["id"]);
            break;
        case "hide":
            if (isset($_GET["id"]))
                $value = hide($_GET["id"]);
            break;
        case "login":
            if (isset($_GET["user"],$_GET["pass"]))
                $value = login($_GET["user"],$_GET["pass"]);
            break;
        case "autoLogin":
            if (isset($_GET["modhash"],$_GET["cookie"]))
                $value = autoLogin($_GET["modhash"],$_GET["cookie"]);
            break;
        case "logout":
            $value = logout();
            break;
        case "getListing":
            if (isset($_GET["sr"],$_GET["sort"],$_GET["limit"]))
                if (isset($_GET["after"]))
                    $value = getListing($_GET["sr"],$_GET["sort"],$_GET["limit"],$_GET["after"]);
                else
                    $value = getListing($_GET["sr"],$_GET["sort"],$_GET["limit"]);
            break;
        case "imgAjax":
            if (isset($_GET["url"]))
                $value = imgAjax($_GET["url"]);
            break;
    }
}

//return JSON array
exit(json_encode($value));
?>