<?php

require_once("reddit.php");

function login($user,$pass)
{
    $reddit = new reddit();
    $login_info = $reddit->login($user,$pass);
    $user_info = $reddit->getUser();
    session_start();
    $_SESSION['reddit'] = $reddit;

    return (object)array("session" => $login_info, "userInfo" => $user_info);
}

function autoLogin($modhash,$cookie)
{
    $reddit = new reddit();
    $reddit->resume($modhash,$cookie);
    $user_info = $reddit->getUser();
    session_start();
    $_SESSION['reddit'] = $reddit;
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

function cast_vote($id,$dir)
{
    session_start();
    if(!isset($_SESSION['reddit']) && empty($_SESSION['reddit'])) {
        return 'User must be logged in';
    }
    $reddit = $_SESSION['reddit'];
    $response = $reddit->addVote($id,$dir);
    return $response;
    
}


$value = "An error has occurred";

if (isset($_GET["action"]))
{
  switch ($_GET["action"])
    {
      case "cast_vote":
        if (isset($_GET["id"],$_GET["dir"]))
          $value = cast_vote($_GET["id"],$_GET["dir"]);
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
    }
}

//return JSON array
exit(json_encode($value));
?>