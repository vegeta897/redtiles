<?php
// This is the API, 2 possibilities: show the app list or show a specific app by id.
// This would normally be pulled from a database but for demo purposes, I will be hardcoding the return values.

require_once("reddit.php");

function login($user,$pass)
{
    $reddit = new reddit($user,$pass);
    $user_info = $reddit->getUser();
    session_start();
    $_SESSION['reddit'] = $reddit;

    return $user_info;
}

function cast_vote($id,$dir)
{
    session_start();
    $reddit = $_SESSION['reddit'];
    $response = $reddit->addVote($id,$dir);
    return $response;
}

$possible_url = array("cast_vote", "login");

$value = "An error has occurred";

if (isset($_GET["action"]) && in_array($_GET["action"], $possible_url))
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
        else
          $value = "Missing argument";
        break;
    }
}


//return JSON array
exit(json_encode($value));
?>