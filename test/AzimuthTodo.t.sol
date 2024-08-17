// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/AzimuthTodo.sol";

contract AzimuthTodoTest is Test {
    AzimuthTodo public azimuthTodo;

    function setUp() public {
        azimuthTodo = new AzimuthTodo();
    }

    function testCreateTodo() public {
        string memory content = "Test Todo";
        string[] memory tags = new string[](1);
        tags[0] = "test";
        
        azimuthTodo.createTodo(content, tags);
        
        AzimuthTodo.Todo[] memory todos = azimuthTodo.getUserTodos(address(this), 0, 10);
        assertEq(todos.length, 1);
        assertEq(todos[0].content, content);
        assertEq(todos[0].tags.length, 1);
        assertEq(todos[0].tags[0], "test");
        assertEq(todos[0].isCompleted, false);
    }

    function testCompleteTodo() public {
        string memory content = "Test Todo";
        string[] memory tags = new string[](0);
        
        azimuthTodo.createTodo(content, tags);
        azimuthTodo.completeTodo(0);
        
        AzimuthTodo.Todo[] memory todos = azimuthTodo.getUserTodos(address(this), 0, 10);
        assertEq(todos.length, 1);
        assertEq(todos[0].isCompleted, true);
    }

    function testGetTodoCount() public {
        string memory content = "Test Todo";
        string[] memory tags = new string[](0);
        
        azimuthTodo.createTodo(content, tags);
        azimuthTodo.createTodo(content, tags);
        
        uint256 count = azimuthTodo.getTodoCount(address(this));
        assertEq(count, 2);
    }

    function testPagination() public {
        for (uint i = 0; i < 15; i++) {
            string memory content = string(abi.encodePacked("Todo ", vm.toString(i)));
            string[] memory tags = new string[](0);
            azimuthTodo.createTodo(content, tags);
        }

        AzimuthTodo.Todo[] memory firstPage = azimuthTodo.getUserTodos(address(this), 0, 10);
        assertEq(firstPage.length, 10);

        AzimuthTodo.Todo[] memory secondPage = azimuthTodo.getUserTodos(address(this), 10, 10);
        assertEq(secondPage.length, 5);
    }
}